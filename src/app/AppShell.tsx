import { Box } from '@chakra-ui/react';
import { Outlet } from 'react-router';
import { useAuthActive } from '@/features/auth/hooks/useAuthActive';
import { Header } from '@/app/components/Header';

export function AppShell() {
  const active = useAuthActive();

  return (
    <Box minH="100vh" bg="gray.100" color="gray.900">
      {active ? <Header /> : null}
      <Box as="main" px="6" py={active ? '8' : '0'}>
        <Outlet />
      </Box>
    </Box>
  );
}
