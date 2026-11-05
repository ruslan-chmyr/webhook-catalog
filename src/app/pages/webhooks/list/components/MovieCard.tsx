import { Button, HStack, Link, Stack, Text } from '@chakra-ui/react';
import type { Webhook } from '@/features/webhooks/model/types';
import { formatDuration, releaseYear } from '../utils/movieFacts';
import { MoviePoster, type PosterPriority } from './MoviePoster';

type MovieCardProps = {
  webhook: Webhook;
  priority: PosterPriority;
  onEdit: (id: string) => void;
};

export function MovieCard({ webhook, priority, onEdit }: MovieCardProps) {
  return (
    <Stack
      as="article"
      aria-label={webhook.name}
      gap="0"
      minW="0"
      borderWidth="1px"
      borderColor="gray.200"
      rounded="lg"
      overflow="hidden"
      bg="gray.50"
      _hover={{ borderColor: 'gray.300', shadow: 'sm' }}
    >
      <MoviePoster posterPath={webhook.poster_path} title={webhook.name} priority={priority} />
      <Stack gap="2" p="3">
        <Text fontWeight="medium" lineClamp={2} minH="2.5rem" title={webhook.name}>
          {webhook.name}
        </Text>
        <HStack justify="space-between" gap="2" fontSize="sm" color="gray.700">
          <HStack gap="1">
            <Text as="span" color="yellow.500" aria-hidden="true">
              ★
            </Text>
            <Text fontVariantNumeric="tabular-nums">{webhook.rating.toFixed(1)}</Text>
          </HStack>
          <Text>{releaseYear(webhook.created_at)}</Text>
        </HStack>
        <Text fontSize="sm" color="gray.600">
          {formatDuration(webhook.duration)}
        </Text>
        <HStack justify="space-between" gap="2">
          <Link
            href={webhook.url}
            target="_blank"
            rel="noopener noreferrer"
            fontSize="sm"
            color="blue.600"
            aria-label={`IMDb page for ${webhook.name}`}
          >
            IMDb
          </Link>
          <Button
            type="button"
            size="xs"
            variant="outline"
            aria-label={`Edit ${webhook.name}`}
            onClick={() => {
              onEdit(webhook.id);
            }}
          >
            Edit
          </Button>
        </HStack>
      </Stack>
    </Stack>
  );
}
