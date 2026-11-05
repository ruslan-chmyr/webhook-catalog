import { Grid } from '@chakra-ui/react';
import type { Webhook } from '@/features/webhooks/model/types';
import { MovieCard } from './MovieCard';
import type { PosterPriority } from './MoviePoster';

type MovieGridProps = {
  webhooks: readonly Webhook[];
  onEdit: (id: string) => void;
};

function posterPriority(index: number): PosterPriority {
  if (index === 0) {
    return 'high';
  }
  if (index < 3) {
    return 'eager';
  }

  return 'lazy';
}

export function MovieGrid({ webhooks, onEdit }: MovieGridProps) {
  return (
    <Grid
      templateColumns={{
        base: 'minmax(0, 1fr)',
        md: 'repeat(2, minmax(0, 1fr))',
        lg: 'repeat(3, minmax(0, 1fr))',
      }}
      gap={{ base: '3', md: '4' }}
    >
      {webhooks.map((webhook, index) => (
        <MovieCard key={webhook.id} webhook={webhook} priority={posterPriority(index)} onEdit={onEdit} />
      ))}
    </Grid>
  );
}
