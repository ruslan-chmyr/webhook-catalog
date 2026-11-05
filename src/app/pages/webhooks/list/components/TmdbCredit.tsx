import { HStack, Text } from '@chakra-ui/react';

export function TmdbCredit() {
  return (
    <HStack as="footer" gap="3" align="flex-start" maxW={{ lg: '28rem' }} flex="1" minW="0">
      <img
        src="/tmdb-blue-short.svg"
        alt="TMDB"
        height={16}
        decoding="async"
        style={{ height: 16, width: 'auto', flexShrink: 0, marginTop: 2 }}
      />
      <Text fontSize="xs" color="gray.600" lineHeight="short">
        This product uses TMDB content but is not endorsed, certified, or otherwise approved by TMDB. Ratings are
        editorial and are not live scores from TMDB or IMDb.
      </Text>
    </HStack>
  );
}
