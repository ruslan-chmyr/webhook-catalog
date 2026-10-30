import { describe, expect, it } from 'vitest';
import { readPostLoginPath } from './loginRedirect';

describe('readPostLoginPath', () => {
  it('returns the home route when login was opened directly', () => {
    expect(readPostLoginPath(null)).toBe('/');
    expect(readPostLoginPath(undefined)).toBe('/');
    expect(readPostLoginPath({})).toBe('/');
  });

  it('restores an internal list location', () => {
    expect(
      readPostLoginPath({
        from: {
          pathname: '/',
          search: '?page=2&search=hook',
        },
      }),
    ).toBe('/?page=2&search=hook');
  });

  it('rejects external and login destinations', () => {
    expect(readPostLoginPath({ from: { pathname: '//evil.test', search: '' } })).toBe('/');
    expect(
      readPostLoginPath({
        from: { pathname: 'https://evil.test', search: '' },
      }),
    ).toBe('/');
    expect(readPostLoginPath({ from: { pathname: '/login', search: '?x=1' } })).toBe('/');
  });
});
