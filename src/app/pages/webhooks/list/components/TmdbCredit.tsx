import { HStack, Text } from '@chakra-ui/react';

export function TmdbCredit() {
  return (
    <HStack as="footer" gap="3" align="center">
      <img
        src="/tmdb-blue-short.svg"
        alt="TMDB"
        height={16}
        decoding="async"
        style={{ height: 16, width: 'auto' }}
      />
      <Text fontSize="xs" color="gray.600">
        This product uses TMDB content but is not endorsed, certified, or otherwise approved by TMDB. Ratings are
        editorial and are not live scores from TMDB or IMDb.
      </Text>
    </HStack>
  );
}
