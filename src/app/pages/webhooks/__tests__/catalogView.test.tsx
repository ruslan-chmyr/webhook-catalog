import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { router } from '@/app/router';
import { login } from '@/features/auth/api/authApi';
import { server } from '@/mocks/server';
import { listWebhooks } from '@/mocks/webhooks';
import { CATALOG_VIEW_STORAGE_KEY } from '../list/hooks/useCatalogViewMode';

const credentials = {
  email: 'demo@example.com',
  password: 'Frame50App-Demo-2026!',
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

async function openWebhooks(path = '/'): Promise<void> {
  await login(credentials);
  await router.navigate(path);
  render(<App />);
}

describe('catalog view', () => {
  it('defaults to the table', async () => {
    await openWebhooks();

    expect(await screen.findByRole('columnheader', { name: 'Movie title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'TMDB' })).toBeInTheDocument();
    expect(screen.getByText(/not endorsed, certified, or otherwise approved by TMDB/)).toBeInTheDocument();
  });

  it('switches to the grid and stores the preference', async () => {
    await openWebhooks();
    fireEvent.click(await screen.findByRole('button', { name: 'Grid' }));

    const card = await screen.findByRole('article', { name: 'The Shawshank Redemption' });
    expect(screen.getAllByRole('article')).toHaveLength(9);
    expect(within(card).getByText('9.3')).toBeInTheDocument();
    expect(within(card).getByText('1994')).toBeInTheDocument();
    expect(within(card).getByText('2h 22m')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Movie title' })).not.toBeInTheDocument();
    expect(localStorage.getItem(CATALOG_VIEW_STORAGE_KEY)).toBe('grid');

    const poster = within(card).getByRole('img', { name: 'Poster for The Shawshank Redemption' });
    expect(poster).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w342/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg');
    expect(poster.getAttribute('srcset')).toContain('https://image.tmdb.org/t/p/w185/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg 185w');
    expect(poster.getAttribute('srcset')).toContain('https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg 500w');
    expect(poster.getAttribute('srcset')).not.toContain('/original/');
    expect(poster).toHaveAttribute('loading', 'eager');
    expect(poster).toHaveAttribute('fetchpriority', 'high');
    expect(poster).toHaveAttribute('decoding', 'async');

    const second = screen.getByRole('img', { name: 'Poster for The Godfather' });
    expect(second).toHaveAttribute('loading', 'eager');
    expect(second).not.toHaveAttribute('fetchpriority');

    const later = screen.getByRole('img', { name: 'Poster for The Lord of the Rings: The Fellowship of the Ring' });
    expect(later).toHaveAttribute('loading', 'lazy');
    expect(later).not.toHaveAttribute('fetchpriority');

    const link = within(card).getByRole('link', { name: 'IMDb page for The Shawshank Redemption' });
    expect(link).toHaveAttribute('href', 'https://www.imdb.com/find/?q=The%20Shawshank%20Redemption');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(within(card).getByRole('button', { name: 'Edit The Shawshank Redemption' }));
    expect(await screen.findByRole('heading', { name: 'Edit Movie' })).toBeInTheDocument();
  });

  it('restores a saved grid preference', async () => {
    localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, 'grid');
    await openWebhooks();

    expect(await screen.findByRole('article', { name: 'The Shawshank Redemption' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('falls back to the table when the stored preference is invalid', async () => {
    localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, 'cards');
    await openWebhooks();

    expect(await screen.findByRole('columnheader', { name: 'Movie title' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(localStorage.getItem(CATALOG_VIEW_STORAGE_KEY)).toBe('cards');
  });

  it('keeps the current search and page without requesting the catalog again', async () => {
    const requests = installWebhookProbe();
    await openWebhooks('/?page=2&search=the');
    expect(await screen.findByRole('cell', { name: 'Gone with the Wind' })).toBeInTheDocument();
    const before = requests.length;

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(await screen.findByRole('article', { name: 'Gone with the Wind' })).toBeInTheDocument();
    expect(requests).toHaveLength(before);
    expect(router.state.location.search).toBe('?page=2&search=the');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(await screen.findByRole('cell', { name: 'Gone with the Wind' })).toBeInTheDocument();
    expect(requests).toHaveLength(before);
    expect(router.state.location.search).toBe('?page=2&search=the');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
