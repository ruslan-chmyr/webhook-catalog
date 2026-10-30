import { act, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { queryClient, session } from '@/app/composition';
import { router } from '@/app/router';
import { server } from '@/mocks/server';
import {
  getMockIssueCount,
  getMockRotateCount,
  pauseNextIssue,
  pauseNextRevoke,
  pauseNextRotation,
  SESSION_TTL_MS,
  setMockAuthNow,
} from '@/mocks/authState';
import { HttpError } from '@/shared/api/errors';
import { login, loadCurrentUser, logout, readDeviceSessionToken } from '../api/authApi';
import { currentUserQueryKey, privateQueryKey } from '../model/currentUser';
import { FINGERPRINT_STORAGE_KEY } from '../model/fingerprint';

const demoUser = {
  id: 'user-1',
  email: 'demo@example.com',
  first_name: 'Demo',
  last_name: 'User',
  name: 'Demo User',
};

function pathnameIs(pathname: string): (args: { request: Request }) => boolean {
  return ({ request }) => new URL(request.url).pathname === pathname;
}

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  if (resolvePromise === undefined) {
    throw new Error('Deferred promise executor did not run.');
  }

  const resolveDeferred = resolvePromise;
  return {
    promise,
    resolve: () => {
      resolveDeferred();
    },
  };
}

async function signIn(): Promise<void> {
  await login({ email: demoUser.email, password: 'WebhookApp-Demo-2026!' });
}

describe('authentication flow', () => {
  it('logs in, issues a session, and loads the current user', async () => {
    expect(session.isActive()).toBe(false);

    await signIn();

    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(0);
    expect(readDeviceSessionToken()).toBe('mock-token');
    expect(Object.keys(localStorage)).toEqual([FINGERPRINT_STORAGE_KEY]);
    const user = await loadCurrentUser();
    expect(user).toEqual(demoUser);
    expect(typeof user.id).toBe('string');
    expect(typeof user.email).toBe('string');
    expect(typeof user.first_name).toBe('string');
    expect(typeof user.last_name).toBe('string');
    expect(typeof user.name).toBe('string');
  });

  it('returns HTTP 422 for invalid credentials', async () => {
    const error = await login({
      email: demoUser.email,
      password: 'wrong-password',
    }).then(
      () => {
        throw new Error('Expected login to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    if (!(error instanceof HttpError)) {
      throw new Error('Expected HttpError.');
    }

    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({
      email: ['These credentials do not match our records.'],
    });
    expect(session.isActive()).toBe(false);
    expect(readDeviceSessionToken()).toBeNull();
  });

  it('does not activate the session when issue fails', async () => {
    server.use(
      http.post(pathnameIs('/auth/token/issue'), () => {
        return HttpResponse.json(
          {
            error: {
              type: 'BadRequestException',
              message: 'Device session cannot be issued.',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(signIn()).rejects.toMatchObject({ status: 400 });
    expect(session.isActive()).toBe(false);
    expect(readDeviceSessionToken()).toBeNull();
  });

  it('rotates an expired session and retries the current user request', async () => {
    let now = 1_000_000;
    setMockAuthNow(() => now);
    await signIn();

    await expect(loadCurrentUser()).resolves.toEqual(demoUser);
    expect(getMockRotateCount()).toBe(0);

    now += SESSION_TTL_MS;

    await expect(loadCurrentUser()).resolves.toEqual(demoUser);
    expect(getMockRotateCount()).toBe(1);
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(1);
  });

  it('shares one rotation across concurrent expired requests', async () => {
    let now = 1_000_000;
    setMockAuthNow(() => now);
    await signIn();
    now += SESSION_TTL_MS;

    const release = createDeferred();
    const entered = createDeferred();
    pauseNextRotation(release.promise, () => {
      entered.resolve();
    });

    const first = loadCurrentUser();
    const second = loadCurrentUser();

    await entered.promise;
    expect(getMockRotateCount()).toBe(1);

    release.resolve();

    await expect(first).resolves.toEqual(demoUser);
    await expect(second).resolves.toEqual(demoUser);
    expect(getMockRotateCount()).toBe(1);
    expect(session.getGeneration()).toBe(1);
  });

  it('invalidates the session when rotation fails', async () => {
    let now = 1_000_000;
    setMockAuthNow(() => now);
    await signIn();
    now += SESSION_TTL_MS;

    server.use(
      http.post(pathnameIs('/auth/token/rotate'), () => {
        return HttpResponse.json(
          {
            error: {
              type: 'BadRequestException',
              message: 'No active session can be rotated.',
            },
          },
          { status: 400 },
        );
      }),
    );

    await expect(loadCurrentUser()).rejects.toMatchObject({ status: 400 });
    expect(session.isActive()).toBe(false);
  });

  it('keeps the session active when the current user request fails for a non-auth reason', async () => {
    await signIn();

    server.use(
      http.get(pathnameIs('/v1/me'), () => {
        return HttpResponse.json(
          {
            error: {
              type: 'ServerException',
              message: 'Unavailable.',
            },
          },
          { status: 500 },
        );
      }),
    );

    await expect(loadCurrentUser()).rejects.toMatchObject({ status: 500 });
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(0);
  });

  it('clears local authentication state on logout', async () => {
    await signIn();
    await loadCurrentUser();
    queryClient.setQueryData(currentUserQueryKey, demoUser);

    await logout();

    expect(session.isActive()).toBe(false);
    expect(readDeviceSessionToken()).toBeNull();
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeUndefined();
    await expect(loadCurrentUser()).rejects.toThrow('Cannot send a protected request without an active session.');
  });

  it('returns to login when revoke fails', async () => {
    render(<App />);
    await signInThroughForm();
    expect(await screen.findByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();

    server.use(
      http.post(pathnameIs('/auth/token/revoke'), () => {
        return HttpResponse.json(
          {
            error: {
              type: 'ServerException',
              message: 'Revoke failed.',
            },
          },
          { status: 500 },
        );
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(session.isActive()).toBe(false);
    expect(screen.queryByText(demoUser.email)).not.toBeInTheDocument();
  });

  it('does not reactivate the session when logout happens during rotation', async () => {
    let now = 1_000_000;
    setMockAuthNow(() => now);
    await signIn();
    now += SESSION_TTL_MS;

    const release = createDeferred();
    const entered = createDeferred();
    pauseNextRotation(release.promise, () => {
      entered.resolve();
    });

    const pending = loadCurrentUser();
    await entered.promise;
    await logout();
    release.resolve();

    await expect(pending).rejects.toThrow();
    expect(session.isActive()).toBe(false);
    expect(session.getGeneration()).toBe(0);
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeUndefined();
  });

  it('does not keep private user data for the next login', async () => {
    const release = createDeferred();
    const arrived = createDeferred();
    server.use(
      http.get(pathnameIs('/v1/me'), async () => {
        arrived.resolve();
        await release.promise;
        return HttpResponse.json({
          ...demoUser,
          name: 'Stale User',
          email: 'stale@example.com',
        });
      }),
    );

    render(<App />);
    await signInThroughForm();
    await arrived.promise;

    await act(async () => {
      await logout();
    });

    expect(session.isActive()).toBe(false);
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeUndefined();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    release.resolve();
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('stale@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Stale User')).not.toBeInTheDocument();
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeUndefined();

    server.resetHandlers();
    await signInThroughForm();
    expect(await screen.findByText(demoUser.email)).toBeInTheDocument();
    expect(queryClient.getQueryData(currentUserQueryKey)).toEqual(demoUser);
  });

  it('shows field errors and the header email after a successful sign-in', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: demoUser.email },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('These credentials do not match our records.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The given data was invalid.');
    expect(session.isActive()).toBe(false);

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WebhookApp-Demo-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();
    expect(await screen.findByText(demoUser.email)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(session.isActive()).toBe(false);
  });

  it('issues the next session only after a pending revoke settles', async () => {
    await signIn();
    expect(getMockIssueCount()).toBe(1);

    const releaseRevoke = createDeferred();
    const revokeEntered = createDeferred();
    pauseNextRevoke(releaseRevoke.promise, () => {
      revokeEntered.resolve();
    });

    const loggingOut = logout();
    await revokeEntered.promise;

    const loggingIn = signIn();
    expect(getMockIssueCount()).toBe(1);
    expect(session.isActive()).toBe(false);

    releaseRevoke.resolve();
    await loggingOut;
    await loggingIn;

    expect(getMockIssueCount()).toBe(2);
    expect(session.isActive()).toBe(true);
    await expect(loadCurrentUser()).resolves.toEqual(demoUser);
  });

  it('allows a new login after revoke fails', async () => {
    await signIn();

    const releaseRevoke = createDeferred();
    const revokeEntered = createDeferred();
    server.use(
      http.post(pathnameIs('/auth/token/revoke'), async () => {
        revokeEntered.resolve();
        await releaseRevoke.promise;
        return HttpResponse.json(
          {
            error: {
              type: 'ServerException',
              message: 'Revoke failed.',
            },
          },
          { status: 500 },
        );
      }),
    );

    const loggingOut = logout();
    await revokeEntered.promise;

    const loggingIn = signIn();
    expect(getMockIssueCount()).toBe(1);

    releaseRevoke.resolve();
    await loggingOut;
    await loggingIn;

    expect(session.isActive()).toBe(true);
    await expect(loadCurrentUser()).resolves.toEqual(demoUser);
  });

  it('keeps an older login from replacing a newer local session', async () => {
    const releaseFirst = createDeferred();
    const firstEntered = createDeferred();
    const releaseSecond = createDeferred();
    const secondEntered = createDeferred();
    pauseNextIssue(releaseFirst.promise, () => {
      firstEntered.resolve();
    });
    pauseNextIssue(releaseSecond.promise, () => {
      secondEntered.resolve();
    });

    const first = signIn();
    await firstEntered.promise;
    const second = signIn();
    await secondEntered.promise;

    releaseSecond.resolve();
    await second;
    const epoch = session.getAuthEpoch();
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(0);

    releaseFirst.resolve();
    await expect(first).rejects.toThrow('Login attempt is obsolete.');
    expect(session.isActive()).toBe(true);
    expect(session.getAuthEpoch()).toBe(epoch);
    expect(session.getGeneration()).toBe(0);
    await expect(loadCurrentUser()).resolves.toEqual(demoUser);
  });

  it('does not let an obsolete login reactivate an invalidated session', async () => {
    await signIn();

    const releaseIssue = createDeferred();
    const issueEntered = createDeferred();
    pauseNextIssue(releaseIssue.promise, () => {
      issueEntered.resolve();
    });

    const pending = signIn();
    await issueEntered.promise;
    await logout();
    releaseIssue.resolve();

    await expect(pending).rejects.toThrow('Login attempt is obsolete.');
    expect(session.isActive()).toBe(false);
    expect(readDeviceSessionToken()).toBeNull();
    await expect(loadCurrentUser()).rejects.toThrow('Cannot send a protected request without an active session.');
  });

  it('clears private query data and keeps public query data', async () => {
    session.startSession();
    queryClient.setQueryData(currentUserQueryKey, demoUser);
    queryClient.setQueryData([...privateQueryKey, 'billing'], { secret: true });
    queryClient.setQueryData(['catalog'], { name: 'public' });

    session.invalidate('logout');

    expect(queryClient.getQueryData(currentUserQueryKey)).toBeUndefined();
    expect(queryClient.getQueryData([...privateQueryKey, 'billing'])).toBeUndefined();
    expect(queryClient.getQueryData(['catalog'])).toEqual({ name: 'public' });
  });

  it('opens the home list after a direct sign-in', async () => {
    render(<App />);
    await signInThroughForm();

    expect(await screen.findByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('');
  });

  it('returns to the previous list URL after signing in from a protected route', async () => {
    render(<App />);
    await act(async () => {
      await router.navigate('/?page=2&search=hook');
    });

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');

    await signInThroughForm();

    expect(await screen.findByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('?page=2&search=hook');
    expect(await screen.findByRole('searchbox', { name: 'Search webhooks' })).toHaveValue('hook');
  });
});

async function signInThroughForm(): Promise<void> {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: demoUser.email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'WebhookApp-Demo-2026!' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}
