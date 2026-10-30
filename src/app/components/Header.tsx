import { Box, Button, Flex, Heading, HStack, Text } from '@chakra-ui/react';
import { logout } from '@/features/auth/api/authApi';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { BrandMark } from './BrandMark';

export function Header() {
  const user = useCurrentUser();
  const email = user.data?.email;

  return (
    <Box as="header" bg="white" borderBottomWidth="1px" borderColor="gray.200">
      <Flex align="center" justify="space-between" gap="3" maxW="64rem" mx="auto" px="6" py="3">
        <HStack gap="2" minW="0">
          <BrandMark />
          <Heading as="h1" size="md">
            WebhookApp
          </Heading>
        </HStack>
        <HStack gap="2" flexShrink={0}>
          {!!email && (
            <Text fontSize="sm" color="gray.700" truncate maxW="16rem">
              {email}
            </Text>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void logout();
            }}
          >
            Log out
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
}
