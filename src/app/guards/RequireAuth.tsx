import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthActive } from '@/features/auth/hooks/useAuthActive';

type RequireAuthProps = {
  children: ReactNode;
};

export function RequireAuth({ children }: RequireAuthProps) {
  const active = useAuthActive();
  const location = useLocation();

  if (!active) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
          },
        }}
      />
    );
  }

  return children;
}
