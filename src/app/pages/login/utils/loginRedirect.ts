export type LoginLocationState = {
  from?: {
    pathname?: string;
    search?: string;
  };
};

/**
 * Returns a same-origin app path to open after login.
 * External URLs and the login route itself fall back to `/`.
 */
export function readPostLoginPath(state: unknown): string {
  if (!isRecord(state) || !isRecord(state.from)) {
    return '/';
  }

  const pathname = state.from.pathname;
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) {
    return '/';
  }

  if (pathname === '/login') {
    return '/';
  }

  const search = typeof state.from.search === 'string' ? state.from.search : '';
  return `${pathname}${search}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
