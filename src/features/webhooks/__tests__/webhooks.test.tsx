import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { http as transport, queryClient, session } from '@/app/composition';
import { login, logout } from '@/features/auth/api/authApi';
import { server } from '@/mocks/server';
import { HttpError } from '@/shared/api/errors';
import { getWebhooks, parseWebhook } from '../api/webhooksApi';
import { webhooksQueryKey, webhooksQueryPrefix } from '../model/queryKeys';

const listParams = {
  page: 1,
  limit: 9,
  search: '',
} as const;

const credentials = {
  email: 'demo@example.com',
  password: 'Frame50App-Demo-2026!',
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
  it('returns the first page of nine records for an authenticated request', async () => {
    await login(credentials);

    const list = await getWebhooks(listParams);

    expect(list.data.map((webhook) => webhook.name)).toEqual([
      'The Shawshank Redemption',
      'The Godfather',
      '12 Angry Men',
      "Schindler's List",
      'The Lord of the Rings: The Fellowship of the Ring',
      'The Good, the Bad and the Ugly',
      'Pulp Fiction',
      "One Flew Over the Cuckoo's Nest",
      'Goodfellas',
    ]);
    expect(list.data[0]).toMatchObject({
      id: 'the-shawshank-redemption',
      active: false,
      rating: 9.3,
      duration: 142,
      poster_path: '/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg',
      created_at: '1994-09-23T12:00:00.000Z',
      url: 'https://www.imdb.com/find/?q=The%20Shawshank%20Redemption',
    });
  });

  it('returns the documented pagination metadata', async () => {
    await login(credentials);

    const list = await getWebhooks(listParams);

    expect(list.paging).toEqual({
      pages: { current: 1, last: 6 },
      results: { total: 50, limitation: 9 },
    });
  });

  it('searches movie titles and ignores the IMDb URL', async () => {
    await login(credentials);

    const byUrlFragment = await getWebhooks({
      page: 1,
      limit: 10,
      search: 'imdb',
    });
    expect(byUrlFragment.data).toEqual([]);
    expect(byUrlFragment.paging.results.total).toBe(0);

    const byName = await getWebhooks({
      page: 1,
      limit: 10,
      search: 'Citizen Kane',
    });
    expect(byName.data.map((webhook) => webhook.id)).toEqual(['citizen-kane']);
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

    expect(await screen.findByRole('heading', { name: '50 Greatest Movies of All Time' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'The Shawshank Redemption' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Goodfellas' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'The Matrix' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2h 22m' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Sep 23, 1994' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Movie title',
      'Rating',
      'IMDb link',
      'Duration',
      'Released at',
      'Actions',
    ]);
    expect(screen.getByRole('cell', { name: '9.2' })).toBeInTheDocument();
    const link = screen.getByTitle('https://www.imdb.com/find/?q=The%20Shawshank%20Redemption');
    expect(link.textContent ?? '').toMatch(/…$/);
    expect(link.textContent ?? '').not.toBe('https://www.imdb.com/find/?q=The%20Shawshank%20Redemption');
  });

  it('copies the full IMDb link from the shortened cell', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const clipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      render(<App />);
      await signInThroughForm();
      fireEvent.click(await screen.findByRole('button', { name: 'Copy IMDb link for The Shawshank Redemption' }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('https://www.imdb.com/find/?q=The%20Shawshank%20Redemption');
      });
      expect(screen.getByRole('button', { name: 'Copied IMDb link for The Shawshank Redemption' })).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: clipboard,
      });
    }
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
              rating: 8,
              duration: 90,
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

    expect(await screen.findByText('Loading movies…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Refreshing movies')).not.toBeInTheDocument();
    await arrived.promise;
    release.resolve();
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(screen.queryByText('Loading movies…')).not.toBeInTheDocument();
  });

  it('keeps the table visible during a background refetch', async () => {
    render(<App />);
    await signInThroughForm();
    expect(await screen.findByRole('cell', { name: 'The Shawshank Redemption' })).toBeInTheDocument();

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
              rating: 8,
              duration: 90,
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

    expect(screen.getByRole('cell', { name: 'The Shawshank Redemption' })).toBeInTheDocument();
    expect(screen.queryByText('Loading movies…')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Refreshing movies')).toBeInTheDocument();

    release.resolve();
    await waitFor(() => {
      expect(screen.queryByLabelText('Refreshing movies')).not.toBeInTheDocument();
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

    expect(await screen.findByText('No movies found.')).toBeInTheDocument();
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
    expect(await screen.findByRole('cell', { name: 'The Shawshank Redemption' })).toBeInTheDocument();
    expect(queryClient.getQueryData(webhooksQueryKey(listParams))).toBeDefined();

    await logout();

    expect(session.isActive()).toBe(false);
    expect(queryClient.getQueryData(webhooksQueryKey(listParams))).toBeUndefined();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('parses a missing or null poster path', () => {
    const record = {
      id: 'citizen-kane',
      name: 'Citizen Kane',
      url: 'https://example.com/kane',
      rating: 8.3,
      duration: 119,
      active: true,
      created_at: '1941-05-01T12:00:00.000Z',
    };

    expect(parseWebhook(record).poster_path).toBeNull();
    expect(parseWebhook({ ...record, poster_path: null }).poster_path).toBeNull();
    expect(parseWebhook({ ...record, poster_path: '/sav0jxhqiH0bPr2vZFU0Kjt2nZL.jpg' }).poster_path).toBe(
      '/sav0jxhqiH0bPr2vZFU0Kjt2nZL.jpg',
    );
  });

  it('rejects an invalid poster path', () => {
    const record = {
      id: 'citizen-kane',
      name: 'Citizen Kane',
      url: 'https://example.com/kane',
      rating: 8.3,
      duration: 119,
      active: true,
      created_at: '1941-05-01T12:00:00.000Z',
    };

    expect(() => parseWebhook({ ...record, poster_path: 'poster.jpg' })).toThrow('Webhooks response is invalid.');
    expect(() => parseWebhook({ ...record, poster_path: 1 })).toThrow('Webhooks response is invalid.');
  });
});
