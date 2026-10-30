import { useSyncExternalStore } from 'react';
import { session, subscribeAuth } from '@/app/composition';

export function useAuthActive(): boolean {
  return useSyncExternalStore(
    subscribeAuth,
    () => session.isActive(),
    () => false,
  );
}
