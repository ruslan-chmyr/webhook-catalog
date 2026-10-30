import { QueryClient } from '@tanstack/react-query';
import { clearDeviceSessionToken } from '@/features/auth/model/deviceSession';
import { getOrCreateFingerprint } from '@/features/auth/model/fingerprint';
import { privateQueryKey } from '@/features/auth/model/currentUser';
import { createHttpClient } from '@/shared/api/httpClient';
import { createProtectedClient } from '@/shared/api/protectedClient';
import { createSessionManager } from '@/shared/session/sessionManager';

const authListeners = new Set<() => void>();

export const http = createHttpClient();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export const session = createSessionManager({
  rotateRequest: async () => {
    await http.request({
      method: 'POST',
      path: '/auth/token/rotate',
      body: { fingerprint: getOrCreateFingerprint() },
    });
  },
  onSessionInvalidated: () => {
    void queryClient.cancelQueries({ queryKey: privateQueryKey });
    queryClient.removeQueries({ queryKey: privateQueryKey });
    clearDeviceSessionToken();
    emitAuthChange();
  },
});

export const protectedClient = createProtectedClient({ http, session });

export function establishSession(): void {
  session.startSession();
  emitAuthChange();
}

export function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function emitAuthChange(): void {
  for (const listener of authListeners) {
    listener();
  }
}
