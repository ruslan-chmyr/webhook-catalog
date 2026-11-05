import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MoviePoster, type PosterPriority } from './MoviePoster';

const citizenKanePoster = '/sav0jxhqiH0bPr2vZFU0Kjt2nZL.jpg';
const godfatherPoster = '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg';

function renderPoster(posterPath: string | null, priority: PosterPriority = 'lazy', title = 'Citizen Kane') {
  const ui = (path: string | null, nextTitle: string) => (
    <ChakraProvider value={defaultSystem}>
      <MoviePoster posterPath={path} title={nextTitle} priority={priority} />
    </ChakraProvider>
  );

  return render(ui(posterPath, title));
}

function posterImage(): HTMLElement {
  return screen.getByRole('img', { name: 'Poster for Citizen Kane' });
}

describe('MoviePoster', () => {
  it('shows a placeholder and keeps lazy loading until the image loads', () => {
    renderPoster(citizenKanePoster);

    const image = posterImage();
    const placeholder = screen.getByTestId('poster-placeholder');
    expect(placeholder).toHaveAttribute('data-visible', 'true');
    expect(image).toHaveStyle({ opacity: '0' });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image.getAttribute('srcset')).toContain('w342');
    expect(screen.queryByText('Poster unavailable')).not.toBeInTheDocument();

    fireEvent.load(image);

    expect(placeholder).toHaveAttribute('data-visible', 'false');
    expect(image).toHaveStyle({ opacity: '1' });
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('keeps eager loading on the first posters', () => {
    renderPoster(citizenKanePoster, 'high');

    const image = posterImage();
    expect(image).toHaveAttribute('loading', 'eager');
    expect(image).toHaveAttribute('fetchpriority', 'high');
    expect(screen.getByTestId('poster-placeholder')).toHaveAttribute('data-visible', 'true');
  });

  it('renders a fallback without requesting an image when the poster path is null', () => {
    renderPoster(null);

    expect(screen.getByText('Poster unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Poster for Citizen Kane' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('poster-placeholder')).not.toBeInTheDocument();
  });

  it('replaces a failed poster with the same-sized fallback', () => {
    renderPoster(citizenKanePoster);
    const image = posterImage();

    fireEvent.error(image);

    const fallback = screen.getByText('Poster unavailable');
    expect(screen.queryByRole('img', { name: 'Poster for Citizen Kane' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('poster-placeholder')).not.toBeInTheDocument();
    expect(fallback.parentElement?.parentElement).toHaveStyle({ aspectRatio: '2 / 3' });
  });

  it('does not keep the previous image loaded when the poster path changes', () => {
    const view = renderPoster(citizenKanePoster);
    fireEvent.load(posterImage());
    expect(screen.getByTestId('poster-placeholder')).toHaveAttribute('data-visible', 'false');

    view.rerender(
      <ChakraProvider value={defaultSystem}>
        <MoviePoster posterPath={godfatherPoster} title="The Godfather" priority="lazy" />
      </ChakraProvider>,
    );

    const nextImage = screen.getByRole('img', { name: 'Poster for The Godfather' });
    expect(screen.getByTestId('poster-placeholder')).toHaveAttribute('data-visible', 'true');
    expect(nextImage).toHaveStyle({ opacity: '0' });
    expect(nextImage).toHaveAttribute('src', expect.stringContaining(godfatherPoster));
    expect(screen.queryByRole('img', { name: 'Poster for Citizen Kane' })).not.toBeInTheDocument();
  });
});
