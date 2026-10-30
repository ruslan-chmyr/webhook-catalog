import { describe, expect, it } from 'vitest';
import { mockCsrfToken } from './handlers';

describe('GET /csrf', () => {
  it('returns 204 and an X-CSRF-TOKEN header', async () => {
    const response = await fetch('http://localhost/csrf');

    expect(response.status).toBe(204);
    expect(response.headers.get('X-CSRF-TOKEN')).toBe(mockCsrfToken);
    expect(await response.text()).toBe('');
  });
});
