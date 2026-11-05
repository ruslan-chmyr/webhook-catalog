import { describe, expect, it } from 'vitest';
import { POSTER_CARD_SIZES, posterSrcSet, posterUrl } from './posterUrl';

const posterPath = '/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg';

describe('poster URLs', () => {
  it('builds catalog sizes from the TMDB image CDN', () => {
    expect(posterUrl(posterPath, 'w185')).toBe(
      'https://image.tmdb.org/t/p/w185/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg',
    );
    expect(posterUrl(posterPath, 'w342')).toBe(
      'https://image.tmdb.org/t/p/w342/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg',
    );
    expect(posterUrl(posterPath, 'w500')).toBe(
      'https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg',
    );
  });

  it('builds a responsive source set without the original asset', () => {
    expect(posterSrcSet(posterPath)).toBe(
      [
        'https://image.tmdb.org/t/p/w185/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg 185w',
        'https://image.tmdb.org/t/p/w342/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg 342w',
        'https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg 500w',
      ].join(', '),
    );
    expect(posterSrcSet(posterPath)).not.toContain('/original/');
  });

  it('targets horizontal card poster widths in sizes', () => {
    expect(POSTER_CARD_SIZES).toBe('(min-width: 48em) 112px, 104px');
    expect(POSTER_CARD_SIZES).not.toContain('136px');
    expect(POSTER_CARD_SIZES).not.toContain('45vw');
  });
});
