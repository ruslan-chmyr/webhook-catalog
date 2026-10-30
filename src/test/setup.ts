import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { queryClient, session } from '@/app/composition';
import { router } from '@/app/router';
import { resetAuthFlow } from '@/features/auth/api/authApi';
import { clearDeviceSessionToken } from '@/features/auth/model/deviceSession';
import { resetMockAuth } from '@/mocks/authState';
import { resetMockWebhooks } from '@/mocks/webhooks';
import { server } from '@/mocks/server';

beforeAll(() => {
  // Chakra waits for animationend before unmounting a closed dialog.
  // jsdom never fires that event, so exit animations are turned off and the dialog can leave the document.
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after {
      animation-name: none !important;
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
  `;
  document.head.appendChild(style);
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  if (session.isActive()) {
    session.invalidate('logout');
  }
  queryClient.clear();
  clearDeviceSessionToken();
  resetAuthFlow();
  resetMockAuth();
  resetMockWebhooks();
  localStorage.clear();
  await router.navigate('/login');
});

afterAll(() => {
  server.close();
});
