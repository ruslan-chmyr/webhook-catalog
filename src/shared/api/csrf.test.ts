import { describe, expect, it } from 'vitest';
import { createCsrfManager } from './csrf';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  if (resolvePromise === undefined || rejectPromise === undefined) {
    throw new Error('Deferred promise executor did not run.');
  }

  const resolveDeferred = resolvePromise;
  const rejectDeferred = rejectPromise;

  return {
    promise,
    resolve: resolveDeferred,
    reject: rejectDeferred,
  };
}

describe('createCsrfManager', () => {
  it('shares one token load across concurrent initialization', async () => {
    const pending = createDeferred<string>();
    let calls = 0;
    const csrf = createCsrfManager({
      loadToken: () => {
        calls += 1;
        return pending.promise;
      },
    });

    const first = csrf.ensure();
    const second = csrf.ensure();
    const third = csrf.ensure();

    expect(calls).toBe(1);

    pending.resolve('token-a');
    await Promise.all([first, second, third]);

    expect(csrf.getToken()).toBe('token-a');
    await csrf.ensure();
    expect(calls).toBe(1);
  });

  it('propagates a failed load and allows a later attempt', async () => {
    const failure = new Error('csrf failed');
    const retry = createDeferred<string>();
    let calls = 0;
    const csrf = createCsrfManager({
      loadToken: () => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(failure);
        }

        return retry.promise;
      },
    });

    const first = csrf.ensure();
    const second = csrf.ensure();

    await Promise.all([expect(first).rejects.toBe(failure), expect(second).rejects.toBe(failure)]);

    expect(csrf.getToken()).toBeNull();

    const third = csrf.ensure();
    expect(calls).toBe(2);

    retry.resolve('token-b');
    await third;
    expect(csrf.getToken()).toBe('token-b');
  });

  it('loads a new token after the cached token is cleared', async () => {
    const tokens = ['first-token', 'second-token'];
    let calls = 0;
    const csrf = createCsrfManager({
      loadToken: () => {
        const next = tokens[calls];
        calls += 1;
        if (next === undefined) {
          return Promise.reject(new Error('Unexpected token load.'));
        }

        return Promise.resolve(next);
      },
    });

    await csrf.ensure();
    expect(csrf.getToken()).toBe('first-token');

    csrf.clear();
    expect(csrf.getToken()).toBeNull();

    await csrf.ensure();
    expect(calls).toBe(2);
    expect(csrf.getToken()).toBe('second-token');
  });

  it('does not let an obsolete load replace a newer token', async () => {
    const firstLoad = createDeferred<string>();
    const secondLoad = createDeferred<string>();
    let calls = 0;
    const csrf = createCsrfManager({
      loadToken: () => {
        calls += 1;
        return calls === 1 ? firstLoad.promise : secondLoad.promise;
      },
    });

    const oldInitialization = csrf.ensure();
    csrf.clear();
    const newInitialization = csrf.refresh();

    expect(calls).toBe(2);

    firstLoad.resolve('stale-token');
    await expect(oldInitialization).rejects.toThrow('CSRF token request is obsolete.');

    const shared = csrf.ensure();
    expect(calls).toBe(2);
    expect(csrf.getToken()).toBeNull();

    secondLoad.resolve('fresh-token');
    await Promise.all([newInitialization, shared]);

    expect(csrf.getToken()).toBe('fresh-token');
    expect(calls).toBe(2);
  });
});
