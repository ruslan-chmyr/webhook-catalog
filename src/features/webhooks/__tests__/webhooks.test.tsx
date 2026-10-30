import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { http as transport, queryClient, session } from '@/app/composition';
import { login, logout } from '@/features/auth/api/authApi';
import { server } from '@/mocks/server';
import { HttpError } from '@/shared/api/errors';
import { getWebhooks } from '../api/webhooksApi';
import { webhooksQueryKey, webhooksQueryPrefix } from '../model/queryKeys';

const listParams = {
  page: 1,
  limit: 10,
  search: '',
} as const;

const credentials = {
  email: 'demo@example.com',
  password: 'WebhookApp-Demo-2026!',
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

async function signInThroughForm(): Promise<void> {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: credentials.email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: credentials.password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('webhooks', () => {
  it('returns the first 10 records for an authenticated request', async () => {
    await login(credentials);

    const list = await getWebhooks(listParams);

    expect(list.data.map((webhook) => webhook.name)).toEqual([
      'Webhook 01',
      'Webhook 02',
      'Webhook 03',
      'Webhook 04',
      'Webhook 05',
      'Webhook 06',
      'Webhook 07',
      'Webhook 08',
      'Webhook 09',
      'Webhook 10',
    ]);
    expect(list.data[0]).toMatchObject({
      id: 'webhook-01',
      active: true,
    });
    expect(list.data[0]?.url.length).toBeGreaterThan(80);
  });

  it('returns the documented pagination metadata', async () => {
    await login(credentials);

    const list = await getWebhooks(listParams);

    expect(list.paging).toEqual({
      pages: { current: 1, last: 3 },
      results: { total: 28, limitation: 10 },
    });
  });

  it('searches webhook names and ignores the destination URL', async () => {
    await login(credentials);

    const byUrlFragment = await getWebhooks({
      page: 1,
      limit: 10,
      search: 'destination',
    });
    expect(byUrlFragment.data).toEqual([]);
    expect(byUrlFragment.paging.results.total).toBe(0);

    const byName = await getWebhooks({
      page: 1,
      limit: 10,
      search: 'Webhook 01',
    });
    expect(byName.data.map((webhook) => webhook.id)).toEqual(['webhook-01']);
  });

  it('returns HTTP 401 when the mock session is missing', async () => {
    const error = await transport.request({ path: '/v1/webhooks?page=1&limit=10&search=' }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 401 });
  });

  it('renders the first page of webhooks', async () => {
    render(<App />);
    await signInThroughForm();

    expect(await screen.findByRole('heading', { name: 'Webhooks' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Webhook 10' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 11' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    expect(screen.getByText(/destination\/destination/)).toBeInTheDocument();
  });

  it('shows a loading state until the list arrives', async () => {
    const release = createDeferred();
    const arrived = createDeferred();
    server.use(
      http.get(pathnameIs('/v1/webhooks'), async () => {
        arrived.resolve();
        await release.promise;
        return HttpResponse.json({
          data: [
            {
              id: 'webhook-01',
              name: 'Webhook 01',
              url: 'https://example.com/hooks/webhook-01',
              active: true,
              created_at: '2024-01-01T12:00:00.000Z',
            },
          ],
          paging: {
            pages: { current: 1, last: 1 },
            results: { total: 1, limitation: 10 },
          },
        });
      }),
    );

    render(<App />);
    await signInThroughForm();

    expect(await screen.findByText('Loading webhooks…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Refreshing webhooks')).not.toBeInTheDocument();
    await arrived.promise;
    release.resolve();
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(screen.queryByText('Loading webhooks…')).not.toBeInTheDocument();
  });

  it('keeps the table visible during a background refetch', async () => {
    render(<App />);
    await signInThroughForm();
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();

    const release = createDeferred();
    const arrived = createDeferred();
    server.use(
      http.get(pathnameIs('/v1/webhooks'), async () => {
        arrived.resolve();
        await release.promise;
        return HttpResponse.json({
          data: [
            {
              id: 'webhook-01',
              name: 'Webhook 01',
              url: 'https://example.com/hooks/webhook-01',
              active: true,
              created_at: '2024-01-01T12:00:00.000Z',
            },
          ],
          paging: {
            pages: { current: 1, last: 1 },
            results: { total: 1, limitation: 10 },
          },
        });
      }),
    );

    void queryClient.invalidateQueries({ queryKey: webhooksQueryPrefix });
    await arrived.promise;

    expect(screen.getByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(screen.queryByText('Loading webhooks…')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Refreshing webhooks')).toBeInTheDocument();

    release.resolve();
    await waitFor(() => {
      expect(screen.queryByLabelText('Refreshing webhooks')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    server.use(
      http.get(pathnameIs('/v1/webhooks'), () => {
        return HttpResponse.json({
          data: [],
          paging: {
            pages: { current: 1, last: 1 },
            results: { total: 0, limitation: 10 },
          },
        });
      }),
    );

    render(<App />);
    await signInThroughForm();

    expect(await screen.findByText('No webhooks found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error state', async () => {
    let calls = 0;
    server.use(
      http.get(pathnameIs('/v1/webhooks'), () => {
        calls += 1;
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

    render(<App />);
    await signInThroughForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable.');
    const callsBeforeRetry = calls;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(calls).toBeGreaterThan(callsBeforeRetry);
    });
  });

  it('removes cached webhooks when the session ends', async () => {
    render(<App />);
    await signInThroughForm();
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(queryClient.getQueryData(webhooksQueryKey(listParams))).toBeDefined();

    await logout();

    expect(session.isActive()).toBe(false);
    expect(queryClient.getQueryData(webhooksQueryKey(listParams))).toBeUndefined();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
