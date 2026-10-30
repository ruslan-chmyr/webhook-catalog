import { createBrowserRouter } from 'react-router';
import { LoginPage } from '@/app/pages/login/LoginPage';
import { RequireAuth } from '@/app/guards/RequireAuth';
import { WebhooksPage } from '@/app/pages/webhooks/list/WebhooksPage';
import { AppShell } from './AppShell';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <RequireAuth>
            <WebhooksPage />
          </RequireAuth>
        ),
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
    ],
  },
]);
