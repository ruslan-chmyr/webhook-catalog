export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const POSTER_WIDTHS = ['w185', 'w342', 'w500'] as const;

export type PosterWidth = (typeof POSTER_WIDTHS)[number];

export const POSTER_DEFAULT_WIDTH: PosterWidth = 'w342';

export const POSTER_SIZES = '(min-width: 62em) 220px, (min-width: 48em) 30vw, 45vw';

export function posterUrl(posterPath: string, width: PosterWidth): string {
  return `${TMDB_IMAGE_BASE}${width}${posterPath}`;
}

export function posterSrcSet(posterPath: string): string {
  return POSTER_WIDTHS.map((width) => `${posterUrl(posterPath, width)} ${width.slice(1)}w`).join(', ');
}
