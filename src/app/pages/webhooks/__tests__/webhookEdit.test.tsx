import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { http as transport, queryClient } from '@/app/composition';
import { login, logout } from '@/features/auth/api/authApi';
import { privateQueryKey } from '@/features/auth/model/currentUser';
import { server } from '@/mocks/server';
import { updateWebhook as persistWebhook } from '@/mocks/webhooks';
import { HttpError } from '@/shared/api/errors';
import { getWebhook, getWebhooks, updateWebhook } from '@/features/webhooks/api/webhooksApi';
import { webhookQueryKey } from '@/features/webhooks/model/queryKeys';

const credentials = {
  email: 'demo@example.com',
  password: 'Frame50App-Demo-2026!',
};

function isWebhookDetail({ request }: { request: Request }): boolean {
  return /^\/v1\/webhooks\/[^/]+$/.test(new URL(request.url).pathname);
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

async function openWebhooks(): Promise<void> {
  await login(credentials);
  render(<App />);
}

async function openEditor(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }));
  expect(await screen.findByLabelText('Movie title')).toBeInTheDocument();
}

describe('webhook detail and editing', () => {
  it('returns an authenticated webhook detail', async () => {
    await login(credentials);

    await expect(getWebhook('citizen-kane')).resolves.toMatchObject({
      id: 'citizen-kane',
      name: 'Citizen Kane',
      active: true,
      duration: 119,
      created_at: '1941-05-01T12:00:00.000Z',
    });
  });

  it('returns HTTP 404 for an unknown webhook', async () => {
    await login(credentials);

    const error = await getWebhook('missing').then(
      () => {
        throw new Error('Expected the detail request to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 404, message: 'Webhook not found.' });
  });

  it('updates the name and URL', async () => {
    await login(credentials);

    await expect(
      updateWebhook('the-godfather', {
        name: 'Renamed hook',
        url: 'https://example.com/renamed',
      }),
    ).resolves.toMatchObject({
      id: 'the-godfather',
      name: 'Renamed hook',
      url: 'https://example.com/renamed',
    });

    await expect(getWebhook('the-godfather')).resolves.toMatchObject({
      name: 'Renamed hook',
      url: 'https://example.com/renamed',
    });
  });

  it('preserves id, active, and created_at', async () => {
    await login(credentials);
    const before = await getWebhook('casablanca');

    const updated = await updateWebhook('casablanca', {
      name: 'Updated webhook',
      url: 'https://example.com/webhook',
    });

    expect(updated).toMatchObject({
      id: before.id,
      active: before.active,
      rating: before.rating,
      duration: before.duration,
      created_at: before.created_at,
      name: 'Updated webhook',
      url: 'https://example.com/webhook',
    });
  });

  it('returns a field error when the name is empty', async () => {
    await login(credentials);

    const error = await updateWebhook('citizen-kane', {
      name: '   ',
      url: 'https://example.com/hooks/citizen-kane',
    }).then(
      () => {
        throw new Error('Expected the update to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      status: 422,
      fieldErrors: { name: ['Name is required.'] },
    });

    const emptyUrl = await updateWebhook('citizen-kane', {
      name: 'Citizen Kane',
      url: '   ',
    }).then(
      () => {
        throw new Error('Expected the update to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(emptyUrl).toBeInstanceOf(HttpError);
    expect(emptyUrl).toMatchObject({
      status: 422,
      fieldErrors: { url: ['URL is required.'] },
    });
    await expect(getWebhook('citizen-kane')).resolves.toMatchObject({
      name: 'Citizen Kane',
    });
  });

  it('returns a field error when the URL is invalid', async () => {
    await login(credentials);

    const error = await updateWebhook('citizen-kane', {
      name: 'Citizen Kane',
      url: 'not a url',
    }).then(
      () => {
        throw new Error('Expected the update to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      status: 422,
      fieldErrors: { url: ['Must be a valid HTTP/HTTPS URL.'] },
    });
  });

  it('rejects unsupported URL schemes', async () => {
    await login(credentials);

    for (const url of ['javascript:alert(1)', 'ftp://example.com/hook']) {
      const error = await updateWebhook('citizen-kane', {
        name: 'Citizen Kane',
        url,
      }).then(
        () => {
          throw new Error('Expected the update to fail.');
        },
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({
        status: 422,
        fieldErrors: { url: ['Must be a valid HTTP/HTTPS URL.'] },
      });
    }

    await expect(getWebhook('citizen-kane')).resolves.toMatchObject({
      name: 'Citizen Kane',
    });
  });

  it('finds an updated webhook through search', async () => {
    await login(credentials);
    await updateWebhook('the-wizard-of-oz', {
      name: 'Renamed target',
      url: 'https://example.com/renamed-target',
    });

    const found = await getWebhooks({
      page: 1,
      limit: 10,
      search: 'Renamed target',
    });
    expect(found.data.map((webhook) => webhook.id)).toEqual(['the-wizard-of-oz']);

    const previous = await getWebhooks({
      page: 1,
      limit: 10,
      search: 'The Wizard of Oz',
    });
    expect(previous.data).toEqual([]);
    expect(found.paging).toEqual({
      pages: { current: 1, last: 1 },
      results: { total: 1, limitation: 10 },
    });
  });

  it('opens the editor with that webhook', async () => {
    await openWebhooks();
    await openEditor('The Shawshank Redemption');

    expect(screen.getByRole('heading', { name: 'Edit Movie' })).toBeInTheDocument();
    expect(screen.getByLabelText('Movie title')).toHaveValue('The Shawshank Redemption');
    expect(screen.getByLabelText('IMDb link')).toHaveValue('https://www.imdb.com/find/?q=The%20Shawshank%20Redemption');
  });

  it('leaves the webhook unchanged when editing is cancelled', async () => {
    await openWebhooks();
    await openEditor('The Shawshank Redemption');

    fireEvent.change(screen.getByLabelText('Movie title'), {
      target: { value: 'Temporary name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Movie' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('cell', { name: 'The Shawshank Redemption' })).toBeInTheDocument();

    await openEditor('The Shawshank Redemption');
    expect(screen.getByLabelText('Movie title')).toHaveValue('The Shawshank Redemption');
  });

  it('saves the webhook into the list', async () => {
    await openWebhooks();
    await openEditor('The Shawshank Redemption');

    fireEvent.change(screen.getByLabelText('Movie title'), {
      target: { value: 'Renamed hook' },
    });
    fireEvent.change(screen.getByLabelText('IMDb link'), {
      target: { value: 'https://example.com/renamed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('cell', { name: 'Renamed hook' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'The Shawshank Redemption' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Movie' })).not.toBeInTheDocument();
    });
    await expect(getWebhook('the-shawshank-redemption')).resolves.toMatchObject({
      id: 'the-shawshank-redemption',
      name: 'Renamed hook',
      url: 'https://example.com/renamed',
      active: false,
      duration: 142,
      created_at: '1994-09-23T12:00:00.000Z',
    });
  });

  it('ignores a second save while the first request is in flight', async () => {
    const release = createDeferred();
    const arrived = createDeferred();
    let calls = 0;
    server.use(
      http.put(isWebhookDetail, async ({ request }) => {
        calls += 1;
        const body: unknown = await request.json();
        arrived.resolve();
        await release.promise;
        const result = persistWebhook('the-shawshank-redemption', body);
        if (!result.ok || result.value === null) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json(result.value);
      }),
    );

    await openWebhooks();
    await openEditor('The Shawshank Redemption');
    fireEvent.change(screen.getByLabelText('Movie title'), {
      target: { value: 'Once only' },
    });
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);

    await arrived.promise;
    expect(calls).toBe(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    release.resolve();
    expect(await screen.findByRole('cell', { name: 'Once only' })).toBeInTheDocument();
  });

  it('shows HTTP 422 errors beside the matching inputs', async () => {
    server.use(
      http.put(isWebhookDetail, () => {
        return HttpResponse.json(
          {
            error: {
              type: 'ValidationException',
              message: 'The given data was invalid.',
              payload: {
                name: ['Name is required.'],
                url: ['Must be a valid HTTP/HTTPS URL.'],
              },
            },
          },
          { status: 422 },
        );
      }),
    );

    await openWebhooks();
    await openEditor('The Shawshank Redemption');
    fireEvent.change(screen.getByLabelText('Movie title'), {
      target: { value: 'Still valid' },
    });
    fireEvent.change(screen.getByLabelText('IMDb link'), {
      target: { value: 'https://example.com/ok' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('IMDb link')).toHaveAttribute('aria-describedby', 'webhook-url-error');
    expect(document.getElementById('webhook-url-error')).toHaveTextContent('Must be a valid HTTP/HTTPS URL.');
    expect(screen.getByLabelText('Movie title')).toHaveValue('Still valid');
    expect(screen.getByLabelText('IMDb link')).toHaveValue('https://example.com/ok');
    expect(screen.getByRole('heading', { name: 'Edit Movie' })).toBeInTheDocument();
  });

  it('keeps the entered values when saving fails', async () => {
    server.use(
      http.put(isWebhookDetail, () => {
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

    await openWebhooks();
    await openEditor('The Godfather');
    fireEvent.change(screen.getByLabelText('Movie title'), {
      target: { value: 'Keep this name' },
    });
    fireEvent.change(screen.getByLabelText('IMDb link'), {
      target: { value: 'https://example.com/keep' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable.');
    expect(screen.getByLabelText('Movie title')).toHaveValue('Keep this name');
    expect(screen.getByLabelText('IMDb link')).toHaveValue('https://example.com/keep');
    expect(screen.getByRole('heading', { name: 'Edit Movie' })).toBeInTheDocument();
    await expect(getWebhook('the-godfather')).resolves.toMatchObject({
      name: 'The Godfather',
    });
  });

  it('does not write a finished edit into the next session after logout', async () => {
    const release = createDeferred();
    const arrived = createDeferred();
    server.use(
      http.put(isWebhookDetail, async () => {
        arrived.resolve();
        await release.promise;
        return HttpResponse.json({
          id: 'the-shawshank-redemption',
          name: 'Should Not Cache',
          url: 'https://example.com/stale',
          rating: 9.3,
          duration: 142,
          active: false,
          created_at: '1994-09-23T12:00:00.000Z',
        });
      }),
    );

    await openWebhooks();
    await openEditor('The Shawshank Redemption');
    fireEvent.change(screen.getByLabelText('Movie title'), {
      target: { value: 'Should Not Cache' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await arrived.promise;

    await logout();
    release.resolve();
    await act(async () => {
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(webhookQueryKey('the-shawshank-redemption'))).toBeUndefined();
    expect(JSON.stringify(queryClient.getQueriesData({ queryKey: privateQueryKey }))).not.toContain('Should Not Cache');

    await login(credentials);
    expect(await screen.findByRole('cell', { name: 'The Shawshank Redemption' })).toBeInTheDocument();
    expect(screen.queryByText('Should Not Cache')).not.toBeInTheDocument();
    expect(queryClient.getQueryData(webhookQueryKey('the-shawshank-redemption'))).toBeUndefined();
  });

  it('returns HTTP 401 for a detail request without a session', async () => {
    const error = await transport.request({ path: '/v1/webhooks/citizen-kane' }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 401 });
  });
});
