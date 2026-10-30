import { useQuery } from '@tanstack/react-query';
import { loadCurrentUser } from '../api/authApi';
import { currentUserQueryKey } from '../model/currentUser';
import { useAuthActive } from './useAuthActive';

export function useCurrentUser() {
  const active = useAuthActive();

  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: ({ signal }) => loadCurrentUser(signal),
    enabled: active,
    retry: false,
  });
}
