import { useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import {
  POSTER_CARD_SIZES,
  POSTER_DEFAULT_WIDTH,
  posterSrcSet,
  posterUrl,
} from '@/features/webhooks/utils/posterUrl';

export type PosterPriority = 'high' | 'eager' | 'lazy';

type MoviePosterProps = {
  posterPath: string | null;
  title: string;
  priority: PosterPriority;
  sizes?: string;
  roundedStart?: boolean;
};

const placeholderBackground =
  'radial-gradient(circle at 30% 18%, #f7f4ee 0%, transparent 46%), linear-gradient(155deg, #d5dde6 0%, #7d8b9c 46%, #e4e8ee 100%)';

export function MoviePoster({
  posterPath,
  title,
  priority,
  sizes = POSTER_CARD_SIZES,
  roundedStart = false,
}: MoviePosterProps) {
  return (
    <Box
      position="relative"
      overflow="hidden"
      bg="gray.200"
      h="full"
      minH="9.75rem"
      style={{ aspectRatio: '2 / 3' }}
      roundedStart={roundedStart ? 'md' : undefined}
    >
      {posterPath === null ? (
        <PosterUnavailable />
      ) : (
        <PosterImage
          key={posterPath}
          posterPath={posterPath}
          title={title}
          priority={priority}
          sizes={sizes}
        />
      )}
    </Box>
  );
}

type PosterImageProps = {
  posterPath: string;
  title: string;
  priority: PosterPriority;
  sizes: string;
};

function PosterImage({ posterPath, title, priority, sizes }: PosterImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <PosterUnavailable />;
  }

  return (
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
        alt={`Poster for ${title}`}
        src={posterUrl(posterPath, POSTER_DEFAULT_WIDTH)}
        srcSet={posterSrcSet(posterPath)}
        sizes={sizes}
        width={342}
        height={513}
        decoding="async"
        loading={priority === 'lazy' ? 'lazy' : 'eager'}
        {...(priority === 'high' ? { fetchPriority: 'high' as const } : {})}
        className="movie-poster-fade"
        onLoad={() => {
          setLoaded(true);
        }}
        onError={() => {
          setFailed(true);
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
  );
}

function PosterUnavailable() {
  return (
    <Flex position="absolute" inset="0" align="center" justify="center" px="2" textAlign="center">
      <Text fontSize="xs" color="gray.600">
        Poster unavailable
      </Text>
    </Flex>
  );
}
