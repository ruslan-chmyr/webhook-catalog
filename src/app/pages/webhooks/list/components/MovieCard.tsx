import { Box, Flex, IconButton, Link, Stack, Text } from '@chakra-ui/react';
import type { Webhook } from '@/features/webhooks/model/types';
import { formatDuration, releaseYear } from '../utils/movieFacts';
import { MoviePoster, type PosterPriority } from './MoviePoster';

type MovieCardProps = {
  webhook: Webhook;
  priority: PosterPriority;
  onEdit: (id: string) => void;
};

export function MovieCard({ webhook, priority, onEdit }: MovieCardProps) {
  const year = releaseYear(webhook.created_at);
  const duration = formatDuration(webhook.duration);

  return (
    <Flex
      as="article"
      aria-label={webhook.name}
      direction="row"
      align="stretch"
      minW="0"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      rounded="lg"
      overflow="hidden"
      shadow="xs"
      transition="border-color 0.15s ease, box-shadow 0.15s ease"
      _hover={{ borderColor: 'gray.300', shadow: 'sm' }}
    >
      <Box flexShrink={0} w={{ base: '6.5rem', md: '7rem' }}>
        <MoviePoster
          posterPath={webhook.poster_path}
          title={webhook.name}
          priority={priority}
          roundedStart
        />
      </Box>
      <Flex direction="column" flex="1" minW="0" p="3" justify="space-between" gap="3">
        <Stack gap="2" minW="0">
          <Text fontWeight="semibold" fontSize="sm" lineClamp={2} title={webhook.name}>
            {webhook.name}
          </Text>
          <Box
            display="inline-flex"
            alignSelf="flex-start"
            alignItems="center"
            gap="1"
            px="2"
            py="0.5"
            rounded="md"
            bg="#fef9e7"
            fontSize="xs"
            fontVariantNumeric="tabular-nums"
            color="gray.800"
          >
            <Text as="span" color="yellow.600" aria-hidden="true">
              ★
            </Text>
            {webhook.rating.toFixed(1)}
          </Box>
          <Text fontSize="xs" color="gray.600">
            {year} · {duration}
          </Text>
        </Stack>
        <Flex align="center" justify="space-between" gap="2">
          <Link
            href={webhook.url}
            target="_blank"
            rel="noopener noreferrer"
            display="inline-flex"
            alignItems="center"
            gap="1"
            fontSize="sm"
            fontWeight="medium"
            color="blue.600"
            _focusVisible={{ outline: '2px solid', outlineColor: 'blue.500', outlineOffset: '2px' }}
            aria-label={`IMDb page for ${webhook.name}`}
          >
            IMDb
            <ExternalLinkIcon />
          </Link>
          <IconButton
            type="button"
            size="xs"
            variant="outline"
            borderColor="gray.300"
            aria-label={`Edit ${webhook.name}`}
            onClick={() => {
              onEdit(webhook.id);
            }}
          >
            <PencilIcon />
          </IconButton>
        </Flex>
      </Flex>
    </Flex>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
