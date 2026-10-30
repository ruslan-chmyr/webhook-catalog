import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { session } from '@/app/composition';
import { acceptLogin } from '@/mocks/authState';
import { server } from '@/mocks/server';

function pathnameIs(pathname: string): (args: { request: Request }) => boolean {
  return ({ request }) => new URL(request.url).pathname === pathname;
}

function trackAuthLogin(): { count: () => number } {
  let count = 0;
  server.use(
    http.post(pathnameIs('/auth/login'), () => {
      count += 1;
      return HttpResponse.json(
        {
          error: {
            type: 'ValidationException',
            message: 'Unexpected login request during client validation.',
          },
        },
        { status: 500 },
      );
    }),
  );

  return {
    count: () => count,
  };
}

describe('login form client validation', () => {
  it('shows field errors for an empty form and does not call auth login', async () => {
    const login = trackAuthLogin();
    render(<App />);

    const submit = screen.getByRole('button', { name: 'Sign in' });
    fireEvent.click(submit);

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(submit).not.toBeDisabled();
    expect(submit).not.toHaveAttribute('data-loading');
    expect(login.count()).toBe(0);
    expect(session.isActive()).toBe(false);
  });

  it('does not call auth login when email is missing', async () => {
    const login = trackAuthLogin();
    render(<App />);

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WebhookApp-Demo-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(login.count()).toBe(0);
  });

  it('does not call auth login when email is invalid', async () => {
    const login = trackAuthLogin();
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WebhookApp-Demo-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(login.count()).toBe(0);
  });

  it('does not call auth login when password is missing', async () => {
    const login = trackAuthLogin();
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Password is required.')).toBeInTheDocument();
    expect(login.count()).toBe(0);
  });

  it('clears a field error when that field is edited', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@example.com' },
    });
    expect(screen.queryByText('Email is required.')).not.toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WebhookApp-Demo-2026!' },
    });
    expect(screen.queryByText('Password is required.')).not.toBeInTheDocument();
  });

  it('still posts invalid credentials and shows HTTP 422 field errors', async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('These credentials do not match our records.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The given data was invalid.');
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toHaveAttribute('data-loading');
    expect(session.isActive()).toBe(false);
  });

  it('shows the button loading state while signing in', async () => {
    const release = createDeferred();
    const arrived = createDeferred();
    server.use(
      http.post(pathnameIs('/auth/login'), async ({ request }) => {
        const body = (await request.json()) as {
          email?: string;
          password?: string;
          fingerprint?: string;
        };
        const captcha = request.headers.get('X-Captcha-Token');
        arrived.resolve();
        await release.promise;
        const result = acceptLogin({
          email: body.email,
          password: body.password,
          fingerprint: body.fingerprint,
          captcha,
        });
        if (!result.ok) {
          return HttpResponse.json(
            {
              error: {
                type: result.type,
                message: result.message,
                ...(result.fieldErrors === undefined ? {} : { payload: result.fieldErrors }),
              },
            },
            { status: result.status },
          );
        }

        return HttpResponse.json(result.value);
      }),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'demo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WebhookApp-Demo-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await arrived.promise;
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('data-loading');

    release.resolve();
    expect(await screen.findByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();
    expect(session.isActive()).toBe(true);
  });
});

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
