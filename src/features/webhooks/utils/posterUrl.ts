export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const POSTER_WIDTHS = ['w185', 'w342', 'w500'] as const;

export type PosterWidth = (typeof POSTER_WIDTHS)[number];

export const POSTER_DEFAULT_WIDTH: PosterWidth = 'w342';

/** Matches MovieCard poster column: 6.5rem (104px) base, 7rem (112px) from md (48em). */
export const POSTER_CARD_SIZES = '(min-width: 48em) 112px, 104px';

export function posterUrl(posterPath: string, width: PosterWidth): string {
  return `${TMDB_IMAGE_BASE}${width}${posterPath}`;
}

export function posterSrcSet(posterPath: string): string {
  return POSTER_WIDTHS.map((width) => `${posterUrl(posterPath, width)} ${width.slice(1)}w`).join(', ');
}
