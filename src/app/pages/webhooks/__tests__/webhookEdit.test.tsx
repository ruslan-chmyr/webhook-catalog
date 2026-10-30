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
  password: 'WebhookApp-Demo-2026!',
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
  expect(await screen.findByLabelText('Name')).toBeInTheDocument();
}

describe('webhook detail and editing', () => {
  it('returns an authenticated webhook detail', async () => {
    await login(credentials);

    await expect(getWebhook('webhook-01')).resolves.toMatchObject({
      id: 'webhook-01',
      name: 'Webhook 01',
      active: true,
      created_at: '2024-01-01T12:00:00.000Z',
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
      updateWebhook('webhook-02', {
        name: 'Renamed hook',
        url: 'https://example.com/renamed',
      }),
    ).resolves.toMatchObject({
      id: 'webhook-02',
      name: 'Renamed hook',
      url: 'https://example.com/renamed',
    });

    await expect(getWebhook('webhook-02')).resolves.toMatchObject({
      name: 'Renamed hook',
      url: 'https://example.com/renamed',
    });
  });

  it('preserves id, active, and created_at', async () => {
    await login(credentials);
    const before = await getWebhook('webhook-03');

    const updated = await updateWebhook('webhook-03', {
      name: 'Updated webhook',
      url: 'https://example.com/webhook',
    });

    expect(updated).toMatchObject({
      id: before.id,
      active: before.active,
      created_at: before.created_at,
      name: 'Updated webhook',
      url: 'https://example.com/webhook',
    });
  });

  it('returns a field error when the name is empty', async () => {
    await login(credentials);

    const error = await updateWebhook('webhook-01', {
      name: '   ',
      url: 'https://example.com/hooks/webhook-01',
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

    const emptyUrl = await updateWebhook('webhook-01', {
      name: 'Webhook 01',
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
    await expect(getWebhook('webhook-01')).resolves.toMatchObject({
      name: 'Webhook 01',
    });
  });

  it('returns a field error when the URL is invalid', async () => {
    await login(credentials);

    const error = await updateWebhook('webhook-01', {
      name: 'Webhook 01',
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
      const error = await updateWebhook('webhook-01', {
        name: 'Webhook 01',
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

    await expect(getWebhook('webhook-01')).resolves.toMatchObject({
      name: 'Webhook 01',
    });
  });

  it('finds an updated webhook through search', async () => {
    await login(credentials);
    await updateWebhook('webhook-04', {
      name: 'Renamed target',
      url: 'https://example.com/renamed-target',
    });

    const found = await getWebhooks({
      page: 1,
      limit: 10,
      search: 'Renamed target',
    });
    expect(found.data.map((webhook) => webhook.id)).toEqual(['webhook-04']);

    const previous = await getWebhooks({
      page: 1,
      limit: 10,
      search: 'Webhook 04',
    });
    expect(previous.data).toEqual([]);
    expect(found.paging).toEqual({
      pages: { current: 1, last: 1 },
      results: { total: 1, limitation: 10 },
    });
  });

  it('opens the editor with that webhook', async () => {
    await openWebhooks();
    await openEditor('Webhook 01');

    expect(screen.getByRole('heading', { name: 'Edit Webhook' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Webhook 01');
    expect(screen.getByLabelText('URL')).toHaveValue(`https://example.com/${'destination/'.repeat(12)}webhook-01`);
  });

  it('leaves the webhook unchanged when editing is cancelled', async () => {
    await openWebhooks();
    await openEditor('Webhook 01');

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Temporary name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Webhook' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();

    await openEditor('Webhook 01');
    expect(screen.getByLabelText('Name')).toHaveValue('Webhook 01');
  });

  it('saves the webhook into the list', async () => {
    await openWebhooks();
    await openEditor('Webhook 01');

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Renamed hook' },
    });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/renamed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('cell', { name: 'Renamed hook' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 01' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Edit Webhook' })).not.toBeInTheDocument();
    });
    await expect(getWebhook('webhook-01')).resolves.toMatchObject({
      id: 'webhook-01',
      name: 'Renamed hook',
      url: 'https://example.com/renamed',
      active: true,
      created_at: '2024-01-01T12:00:00.000Z',
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
        const result = persistWebhook('webhook-01', body);
        if (!result.ok || result.value === null) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json(result.value);
      }),
    );

    await openWebhooks();
    await openEditor('Webhook 01');
    fireEvent.change(screen.getByLabelText('Name'), {
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
    await openEditor('Webhook 01');
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Still valid' },
    });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/ok' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toHaveAttribute('aria-describedby', 'webhook-url-error');
    expect(document.getElementById('webhook-url-error')).toHaveTextContent('Must be a valid HTTP/HTTPS URL.');
    expect(screen.getByLabelText('Name')).toHaveValue('Still valid');
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/ok');
    expect(screen.getByRole('heading', { name: 'Edit Webhook' })).toBeInTheDocument();
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
    await openEditor('Webhook 02');
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Keep this name' },
    });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/keep' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable.');
    expect(screen.getByLabelText('Name')).toHaveValue('Keep this name');
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/keep');
    expect(screen.getByRole('heading', { name: 'Edit Webhook' })).toBeInTheDocument();
    await expect(getWebhook('webhook-02')).resolves.toMatchObject({
      name: 'Webhook 02',
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
          id: 'webhook-01',
          name: 'Should Not Cache',
          url: 'https://example.com/stale',
          active: true,
          created_at: '2024-01-01T12:00:00.000Z',
        });
      }),
    );

    await openWebhooks();
    await openEditor('Webhook 01');
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Should Not Cache' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await arrived.promise;

    await logout();
    release.resolve();
    await act(async () => {
      await Promise.resolve();
    });

    expect(queryClient.getQueryData(webhookQueryKey('webhook-01'))).toBeUndefined();
    expect(JSON.stringify(queryClient.getQueriesData({ queryKey: privateQueryKey }))).not.toContain('Should Not Cache');

    await login(credentials);
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(screen.queryByText('Should Not Cache')).not.toBeInTheDocument();
    expect(queryClient.getQueryData(webhookQueryKey('webhook-01'))).toBeUndefined();
  });

  it('returns HTTP 401 for a detail request without a session', async () => {
    const error = await transport.request({ path: '/v1/webhooks/webhook-01' }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 401 });
  });
});
