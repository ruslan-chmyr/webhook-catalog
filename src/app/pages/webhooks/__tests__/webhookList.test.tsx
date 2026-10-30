import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { queryClient } from '@/app/composition';
import { router } from '@/app/router';
import { login } from '@/features/auth/api/authApi';
import { server } from '@/mocks/server';
import { listWebhooks } from '@/mocks/webhooks';
import { webhooksQueryKey } from '@/features/webhooks/model/queryKeys';
import { WEBHOOK_SEARCH_DEBOUNCE_MS } from '../list/hooks/useWebhookListState';

const credentials = {
  email: 'demo@example.com',
  password: 'WebhookApp-Demo-2026!',
};

function pathnameIs(pathname: string): (args: { request: Request }) => boolean {
  return ({ request }) => new URL(request.url).pathname === pathname;
}

function installWebhookProbe(): string[] {
  const requests: string[] = [];
  server.use(
    http.get(pathnameIs('/v1/webhooks'), ({ request }) => {
      const url = new URL(request.url);
      requests.push(url.search);
      const result = listWebhooks(url);
      if (!result.ok) {
        return HttpResponse.json(
          {
            error: {
              type: result.type,
              message: result.message,
            },
          },
          { status: result.status },
        );
      }

      return HttpResponse.json(result.value);
    }),
  );
  return requests;
}

function requestedPage(search: string): string {
  return new URLSearchParams(search).get('page') ?? '';
}

function requestedSearch(search: string): string {
  return new URLSearchParams(search).get('search') ?? '';
}

async function openWebhooks(path = '/'): Promise<void> {
  await login(credentials);
  await act(async () => {
    await router.navigate(path);
  });
  render(<App />);
}

function searchBox(): HTMLElement {
  return screen.getByRole('searchbox', { name: 'Search webhooks' });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function waitForCell(name: string): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const cell = screen.queryByRole('cell', { name });
    if (cell) {
      return cell;
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  throw new Error(`Timed out waiting for ${name}. Body: ${document.body.textContent}`);
}

async function waitForText(text: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (screen.queryByText(text)) {
      return;
    }

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  throw new Error(`Timed out waiting for ${text}. Body: ${document.body.textContent}`);
}

describe('webhook list URL', () => {
  it('loads page 1 with limit 10 from the default URL', async () => {
    const requests = installWebhookProbe();
    await openWebhooks('/');

    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Webhook 10' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 11' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(requests.some((search) => search === '?page=1&limit=10&search=')).toBe(true);
  });

  it('loads records 11–20 from a direct page 2 URL', async () => {
    const requests = installWebhookProbe();
    await openWebhooks('/?page=2');

    expect(await screen.findByRole('cell', { name: 'Webhook 11' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Webhook 20' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 10' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 21' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(requests.some((search) => requestedPage(search) === '2' && requestedSearch(search) === '')).toBe(true);
    expect(requests.some((search) => search.includes('limit=10'))).toBe(true);
  });

  it('updates the URL from Next and Previous', async () => {
    await openWebhooks('/');
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('cell', { name: 'Webhook 11' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('cell', { name: 'Webhook 21' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Webhook 28' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=3');
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByRole('cell', { name: 'Webhook 11' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('preserves the active search while moving between pages', async () => {
    await openWebhooks('/?search=1');

    expect(await screen.findByRole('searchbox', { name: 'Search webhooks' })).toHaveValue('1');
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Webhook 10' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 02' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('cell', { name: 'Webhook 19' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Webhook 21' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 11' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2&search=1');
    expect(searchBox()).toHaveValue('1');

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByRole('cell', { name: 'Webhook 10' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?search=1');
    expect(searchBox()).toHaveValue('1');
  });

  it('initializes the search box from a direct URL', async () => {
    await openWebhooks('/?page=2&search=1');

    expect(await screen.findByRole('searchbox', { name: 'Search webhooks' })).toHaveValue('1');
    expect(await screen.findByRole('cell', { name: 'Webhook 19' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2&search=1');
  });

  it('rewrites non-canonical URLs without changing the resolved page', async () => {
    await openWebhooks('/?page=1');
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });

    await act(async () => {
      await router.navigate('/?search=%201%20');
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?search=1');
    });
    expect(searchBox()).toHaveValue('1');
    expect(await screen.findByRole('cell', { name: 'Webhook 10' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 02' })).not.toBeInTheDocument();

    await act(async () => {
      await router.navigate('/?search=1&page=2');
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=2&search=1');
    });

    await act(async () => {
      await router.navigate('/?limit=50&page=%202%20');
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=2');
    });
    expect(await screen.findByRole('cell', { name: 'Webhook 11' })).toBeInTheDocument();
  });

  it('normalizes invalid page parameters before requesting them', async () => {
    const requests = installWebhookProbe();
    await openWebhooks('/?page=0');
    expect(await screen.findByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });

    for (const value of ['-4', '2.5', 'abc', '1.0', '01', '2&page=4']) {
      await act(async () => {
        await router.navigate(`/?page=${value}`);
      });
      await waitFor(() => {
        expect(router.state.location.search).toBe('');
      });
      expect(screen.getByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    }

    expect(requests.map(requestedPage).every((page) => page === '1')).toBe(true);
  });

  it('replaces an out-of-range page with the last page once', async () => {
    const requests = installWebhookProbe();
    await openWebhooks('/?page=9');

    expect(await screen.findByRole('cell', { name: 'Webhook 21' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Webhook 28' })).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=3');
    });
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();

    const pages = requests.map(requestedPage);
    expect(pages.every((page) => page === '9' || page === '3')).toBe(true);
    expect(pages.filter((page) => page === '9').length).toBeLessThanOrEqual(2);
    expect(pages.filter((page) => page === '3').length).toBeGreaterThan(0);
    expect(pages.filter((page) => page === '3').length).toBeLessThanOrEqual(2);

    const settled = requests.length;
    await act(async () => {
      await Promise.resolve();
    });
    expect(requests).toHaveLength(settled);
    expect(router.state.location.search).toBe('?page=3');
  });

  it('restores the URL and search input across Back and Forward', async () => {
    await openWebhooks('/?search=1');
    expect(await screen.findByRole('searchbox', { name: 'Search webhooks' })).toHaveValue('1');
    expect(await screen.findByRole('cell', { name: 'Webhook 10' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('cell', { name: 'Webhook 19' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2&search=1');

    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.search).toBe('?search=1');
    expect(searchBox()).toHaveValue('1');
    expect(await screen.findByRole('cell', { name: 'Webhook 10' })).toBeInTheDocument();

    await act(async () => {
      await router.navigate(1);
    });
    expect(router.state.location.search).toBe('?page=2&search=1');
    expect(searchBox()).toHaveValue('1');
    expect(await screen.findByRole('cell', { name: 'Webhook 19' })).toBeInTheDocument();
  });
});

describe('webhook search debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the input immediately and the URL after the delay', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const requests = installWebhookProbe();
    await openWebhooks('/');
    await waitForCell('Webhook 01');
    const before = requests.length;

    fireEvent.change(searchBox(), { target: { value: '  1  ' } });
    expect(searchBox()).toHaveValue('  1  ');
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('cell', { name: 'Webhook 02' })).toBeInTheDocument();

    await advance(WEBHOOK_SEARCH_DEBOUNCE_MS - 1);
    expect(router.state.location.search).toBe('');
    expect(
      requests
        .slice(before)
        .map(requestedSearch)
        .every((search) => search === ''),
    ).toBe(true);

    await advance(1);
    await waitForCell('Webhook 10');
    expect(router.state.location.search).toBe('?search=1');
    expect(searchBox()).toHaveValue('1');
    expect(screen.queryByRole('cell', { name: 'Webhook 02' })).not.toBeInTheDocument();
    expect(requests.slice(before).map(requestedSearch)).toContain('1');
    expect(requests.slice(before).every((search) => requestedPage(search) === '1')).toBe(true);
    expect(queryClient.getQueryData(webhooksQueryKey({ page: 1, limit: 10, search: '1' }))).toBeDefined();
    expect(queryClient.getQueryData(webhooksQueryKey({ page: 1, limit: 10, search: '  1  ' }))).toBeUndefined();
  });

  it('sends only the final value when typing is rapid', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const requests = installWebhookProbe();
    await openWebhooks('/');
    await waitForCell('Webhook 01');
    const before = requests.length;

    fireEvent.change(searchBox(), { target: { value: 'w' } });
    await advance(100);
    fireEvent.change(searchBox(), { target: { value: 'we' } });
    await advance(100);
    fireEvent.change(searchBox(), { target: { value: 'web' } });
    expect(searchBox()).toHaveValue('web');

    await advance(WEBHOOK_SEARCH_DEBOUNCE_MS - 1);
    expect(requests.slice(before)).toEqual([]);

    await advance(1);
    await waitForCell('Webhook 01');
    expect(router.state.location.search).toBe('?search=web');
    const sent = requests.slice(before).map(requestedSearch);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((search) => search === 'web')).toBe(true);
  });

  it('resets to page 1 when the applied search changes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await openWebhooks('/?page=2');
    await waitForCell('Webhook 11');

    fireEvent.change(searchBox(), { target: { value: '1' } });
    await advance(WEBHOOK_SEARCH_DEBOUNCE_MS);
    await waitForCell('Webhook 10');

    expect(router.state.location.search).toBe('?search=1');
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 19' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Webhook 02' })).not.toBeInTheDocument();
  });

  it('restores the unfiltered results when the search is cleared', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await openWebhooks('/?search=1');
    await waitForCell('Webhook 10');
    expect(screen.queryByRole('cell', { name: 'Webhook 02' })).not.toBeInTheDocument();

    fireEvent.change(searchBox(), { target: { value: '' } });
    await advance(WEBHOOK_SEARCH_DEBOUNCE_MS);
    await waitForCell('Webhook 02');

    expect(router.state.location.search).toBe('');
    expect(searchBox()).toHaveValue('');
    expect(screen.getByRole('cell', { name: 'Webhook 01' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await openWebhooks('/');
    await waitForCell('Webhook 01');

    fireEvent.change(searchBox(), { target: { value: 'zzzzzz' } });
    await advance(WEBHOOK_SEARCH_DEBOUNCE_MS);

    await waitForText('No webhooks match your search.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(router.state.location.search).toBe('?search=zzzzzz');
  });

  it('does not let a pending search overwrite Back navigation', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await openWebhooks('/?search=1');
    await waitForCell('Webhook 10');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitForCell('Webhook 19');
    expect(router.state.location.search).toBe('?page=2&search=1');

    fireEvent.change(searchBox(), { target: { value: 'nope' } });
    expect(searchBox()).toHaveValue('nope');
    expect(router.state.location.search).toBe('?page=2&search=1');

    await act(async () => {
      await router.navigate(-1);
    });
    expect(router.state.location.search).toBe('?search=1');
    expect(searchBox()).toHaveValue('1');

    await advance(WEBHOOK_SEARCH_DEBOUNCE_MS + 50);
    expect(router.state.location.search).toBe('?search=1');
    expect(searchBox()).toHaveValue('1');
    expect(screen.getByRole('cell', { name: 'Webhook 10' })).toBeInTheDocument();
    expect(screen.queryByText('No webhooks match your search.')).not.toBeInTheDocument();
  });
});
