import { useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { POSTER_DEFAULT_WIDTH, POSTER_SIZES, posterSrcSet, posterUrl } from '@/features/webhooks/utils/posterUrl';

export type PosterPriority = 'high' | 'eager' | 'lazy';

type MoviePosterProps = {
  posterPath: string | null;
  title: string;
  priority: PosterPriority;
};

const placeholderBackground =
  'radial-gradient(circle at 30% 18%, #f7f4ee 0%, transparent 46%), linear-gradient(155deg, #d5dde6 0%, #7d8b9c 46%, #e4e8ee 100%)';

export function MoviePoster({ posterPath, title, priority }: MoviePosterProps) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);
  const availablePath = posterPath !== null && failedPath !== posterPath ? posterPath : null;
  const loaded = availablePath !== null && loadedPath === availablePath;

  return (
    <Box position="relative" overflow="hidden" bg="gray.200" style={{ aspectRatio: '2 / 3' }}>
      {availablePath !== null ? (
        <>
          <Box
            aria-hidden="true"
            data-testid="poster-placeholder"
            data-visible={loaded ? 'false' : 'true'}
            className="movie-poster-fade"
            position="absolute"
            inset="0"
            style={{
              background: placeholderBackground,
              filter: 'blur(14px)',
              transform: 'scale(1.12)',
              opacity: loaded ? 0 : 1,
            }}
          />
          <img
            key={availablePath}
            alt={`Poster for ${title}`}
            src={posterUrl(availablePath, POSTER_DEFAULT_WIDTH)}
            srcSet={posterSrcSet(availablePath)}
            sizes={POSTER_SIZES}
            width={342}
            height={513}
            decoding="async"
            loading={priority === 'lazy' ? 'lazy' : 'eager'}
            {...(priority === 'high' ? { fetchPriority: 'high' as const } : {})}
            className="movie-poster-fade"
            onLoad={() => {
              setLoadedPath(availablePath);
            }}
            onError={() => {
              setFailedPath(availablePath);
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: loaded ? 1 : 0,
            }}
          />
        </>
      ) : (
        <Flex position="absolute" inset="0" align="center" justify="center" px="3" textAlign="center">
          <Text fontSize="sm" color="gray.600">
            Poster unavailable
          </Text>
        </Flex>
      )}
    </Box>
  );
}
