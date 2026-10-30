import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { createHttpClient, type HttpClient } from './httpClient';
import { HttpError } from './errors';
import { createProtectedClient } from './protectedClient';
import { createSessionManager } from '../session/sessionManager';
import type { SessionEndReason } from '../session/sessionManager.types';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;

  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  if (resolvePromise === undefined) {
    throw new Error('Deferred promise executor did not run.');
  }

  const resolveDeferred = resolvePromise;

  return {
    promise,
    resolve: () => {
      resolveDeferred();
    },
  };
}

function pathnameIs(pathname: string): (args: { request: Request }) => boolean {
  return ({ request }) => new URL(request.url).pathname === pathname;
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

function unauthorized() {
  return HttpResponse.json(
    {
      error: {
        type: 'AuthenticationException',
        message: 'Unauthenticated.',
      },
    },
    { status: 401 },
  );
}

function tokenMismatch() {
  return HttpResponse.json(
    {
      error: {
        type: 'TokenMismatchException',
        message: 'CSRF token mismatch.',
      },
    },
    { status: 419 },
  );
}

function csrfResponse(token: string) {
  return new HttpResponse(null, {
    status: 204,
    headers: {
      'X-CSRF-TOKEN': token,
    },
  });
}

function createSubject(
  rotateRequest: () => Promise<void> = () => Promise.resolve(),
  http: HttpClient = createHttpClient(),
) {
  const reasons: SessionEndReason[] = [];
  const session = createSessionManager({
    rotateRequest,
    onSessionInvalidated: (reason) => {
      reasons.push(reason);
    },
  });
  const client = createProtectedClient({ http, session });

  return { client, session, reasons, http };
}

describe('createProtectedClient', () => {
  it('sends a protected GET for an active session', async () => {
    const { client, session } = createSubject();
    session.startSession();

    server.use(
      http.get(pathnameIs('/v1/me'), ({ request }) => {
        return HttpResponse.json({
          id: 'user-1',
          requestedWith: request.headers.get('X-Requested-With'),
        });
      }),
    );

    await expect(client.request({ path: '/v1/me' })).resolves.toEqual({
      id: 'user-1',
      requestedWith: 'XMLHttpRequest',
    });
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(0);
  });

  it('rejects an inactive session before fetching', async () => {
    const { client } = createSubject();
    let calls = 0;

    server.use(
      http.get(pathnameIs('/v1/me'), () => {
        calls += 1;
        return HttpResponse.json({ id: 'user-1' });
      }),
      http.get(pathnameIs('/csrf'), () => {
        calls += 1;
        return csrfResponse('token');
      }),
    );

    await expect(client.request({ path: '/v1/me' })).rejects.toThrow(
      'Cannot send a protected request without an active session.',
    );
    expect(calls).toBe(0);
  });

  it('rejects a successful response that arrives after logout', async () => {
    const release = createDeferred();
    const arrived = createDeferred();
    const { client, session, reasons } = createSubject();
    session.startSession();

    server.use(
      http.get(pathnameIs('/v1/me'), async () => {
        arrived.resolve();
        await release.promise;
        return HttpResponse.json({ id: 'user-1' });
      }),
    );

    const pending = client.request({ path: '/v1/me' });
    await arrived.promise;
    session.invalidate('logout');
    release.resolve();

    await expect(pending).rejects.toThrow('Protected request is stale.');
    expect(session.isActive()).toBe(false);
    expect(reasons).toEqual(['logout']);
  });

  it('rejects a successful parsed response that arrives after a new login', async () => {
    const release = createDeferred();
    const arrived = createDeferred();
    const { client, session, reasons } = createSubject();
    session.startSession();

    server.use(
      http.get(pathnameIs('/v1/me'), async () => {
        arrived.resolve();
        await release.promise;
        return HttpResponse.json({ id: 'user-1' });
      }),
    );

    const pending = client.request({ path: '/v1/me' }, (value) => {
      if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'string') {
        throw new Error('Expected a user id.');
      }

      return { id: value.id };
    });
    await arrived.promise;
    session.invalidate('logout');
    session.startSession();
    release.resolve();

    await expect(pending).rejects.toThrow('Protected request is stale.');
    expect(session.isActive()).toBe(true);
    expect(session.getAuthEpoch()).toBe(3);
    expect(session.getGeneration()).toBe(0);
    expect(reasons).toEqual(['logout']);
  });

  it('returns a successful response that arrives while the same session remains active', async () => {
    const release = createDeferred();
    const arrived = createDeferred();
    const { client, session } = createSubject();
    session.startSession();
    const epoch = session.getAuthEpoch();

    server.use(
      http.get(pathnameIs('/v1/me'), async () => {
        arrived.resolve();
        await release.promise;
        return HttpResponse.json({ id: 'user-1' });
      }),
    );

    const pending = client.request({ path: '/v1/me' });
    await arrived.promise;
    release.resolve();

    await expect(pending).resolves.toEqual({ id: 'user-1' });
    expect(session.isActive()).toBe(true);
    expect(session.getAuthEpoch()).toBe(epoch);
  });

  it('rotates once when concurrent requests receive HTTP 401', async () => {
    const releaseRotation = createDeferred();
    let rotations = 0;
    const rotationStarted = createDeferred();
    const { client, session } = createSubject(() => {
      rotations += 1;
      rotationStarted.resolve();
      return releaseRotation.promise;
    });
    session.startSession();

    let calls = 0;
    const bothRejected = createDeferred();
    server.use(
      http.get(pathnameIs('/v1/me'), () => {
        calls += 1;
        if (calls <= 2) {
          if (calls === 2) {
            bothRejected.resolve();
          }
          return unauthorized();
        }

        return HttpResponse.json({ ok: true, call: calls });
      }),
    );

    const pending = Promise.all([client.request({ path: '/v1/me' }), client.request({ path: '/v1/me' })]);

    await bothRejected.promise;
    await rotationStarted.promise;
    expect(rotations).toBe(1);

    releaseRotation.resolve();
    await expect(pending).resolves.toEqual([
      { ok: true, call: 3 },
      { ok: true, call: 4 },
    ]);

    expect(rotations).toBe(1);
    expect(calls).toBe(4);
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(1);
  });

  it('retries a late HTTP 401 without a second rotation', async () => {
    let rotations = 0;
    const { client, session } = createSubject(() => {
      rotations += 1;
      return Promise.resolve();
    });
    session.startSession();

    const releaseLate = createDeferred();
    const lateArrived = createDeferred();
    let earlyCalls = 0;
    let lateCalls = 0;

    server.use(
      http.get(pathnameIs('/v1/me'), async ({ request }) => {
        if (request.headers.get('X-Request-Id') === 'late') {
          lateCalls += 1;
          if (lateCalls === 1) {
            lateArrived.resolve();
            await releaseLate.promise;
            return unauthorized();
          }

          return HttpResponse.json({ id: 'late' });
        }

        earlyCalls += 1;
        if (earlyCalls === 1) {
          return unauthorized();
        }

        return HttpResponse.json({ id: 'early' });
      }),
    );

    const late = client.request({
      path: '/v1/me',
      headers: { 'X-Request-Id': 'late' },
    });
    await lateArrived.promise;

    await expect(client.request({ path: '/v1/me', headers: { 'X-Request-Id': 'early' } })).resolves.toEqual({
      id: 'early',
    });
    expect(rotations).toBe(1);

    releaseLate.resolve();
    await expect(late).resolves.toEqual({ id: 'late' });
    expect(rotations).toBe(1);
    expect(lateCalls).toBe(2);
    expect(session.getGeneration()).toBe(1);
  });

  it('invalidates the session when rotation fails', async () => {
    const failure = new Error('rotation failed');
    const { client, session, reasons } = createSubject(() => Promise.reject(failure));
    session.startSession();

    server.use(http.get(pathnameIs('/v1/me'), () => unauthorized()));

    await expect(client.request({ path: '/v1/me' })).rejects.toBe(failure);
    expect(session.isActive()).toBe(false);
    expect(reasons).toEqual(['authentication-failed']);
  });

  it('stops after one HTTP 401 recovery attempt', async () => {
    let calls = 0;
    let rotations = 0;
    const { client, session, reasons } = createSubject(() => {
      rotations += 1;
      return Promise.resolve();
    });
    session.startSession();

    server.use(
      http.get(pathnameIs('/v1/me'), () => {
        calls += 1;
        return unauthorized();
      }),
    );

    const error = await client.request({ path: '/v1/me' }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    if (!(error instanceof HttpError)) {
      throw new Error('Expected HttpError.');
    }

    expect(error.status).toBe(401);
    expect(calls).toBe(2);
    expect(rotations).toBe(1);
    expect(session.isActive()).toBe(false);
    expect(reasons).toEqual(['authentication-failed']);
  });

  it('does not retry after logout during rotation', async () => {
    const releaseRotation = createDeferred();
    const rotationStarted = createDeferred();
    let calls = 0;
    const { client, session, reasons } = createSubject(() => {
      rotationStarted.resolve();
      return releaseRotation.promise;
    });
    session.startSession();

    server.use(
      http.get(pathnameIs('/v1/me'), () => {
        calls += 1;
        return unauthorized();
      }),
    );

    const pending = client.request({ path: '/v1/me' });
    await rotationStarted.promise;
    session.invalidate('logout');
    releaseRotation.resolve();

    await expect(pending).rejects.toThrow('Session changed during rotation.');
    expect(calls).toBe(1);
    expect(session.isActive()).toBe(false);
    expect(reasons).toEqual(['logout']);
  });

  it('does not invalidate a session established after the request started', async () => {
    const releaseRotation = createDeferred();
    const rotationStarted = createDeferred();
    let calls = 0;
    const { client, session, reasons } = createSubject(() => {
      rotationStarted.resolve();
      return releaseRotation.promise;
    });
    session.startSession();

    server.use(
      http.get(pathnameIs('/v1/me'), () => {
        calls += 1;
        return unauthorized();
      }),
    );

    const pending = client.request({ path: '/v1/me' });
    await rotationStarted.promise;
    session.invalidate('logout');
    session.startSession();
    releaseRotation.resolve();

    await expect(pending).rejects.toThrow('Session changed during rotation.');
    expect(calls).toBe(1);
    expect(session.isActive()).toBe(true);
    expect(session.getAuthEpoch()).toBe(3);
    expect(session.getGeneration()).toBe(0);
    expect(reasons).toEqual(['logout']);
  });

  it('lets a cancelled caller skip retry while another caller shares the rotation', async () => {
    const releaseRotation = createDeferred();
    const rotationStarted = createDeferred();
    let rotations = 0;
    let calls = 0;
    const { client, session } = createSubject(() => {
      rotations += 1;
      rotationStarted.resolve();
      return releaseRotation.promise;
    });
    session.startSession();

    const bothRejected = createDeferred();
    server.use(
      http.get(pathnameIs('/v1/me'), () => {
        calls += 1;
        if (calls <= 2) {
          if (calls === 2) {
            bothRejected.resolve();
          }
          return unauthorized();
        }

        return HttpResponse.json({ ok: true });
      }),
    );

    const controller = new AbortController();
    const cancelled = client.request({
      path: '/v1/me',
      signal: controller.signal,
    });
    const other = client.request({ path: '/v1/me' });

    await bothRejected.promise;
    await rotationStarted.promise;
    controller.abort();

    await expect(cancelled).rejects.toSatisfy(isAbortError);

    releaseRotation.resolve();
    await expect(other).resolves.toEqual({ ok: true });
    expect(rotations).toBe(1);
    expect(calls).toBe(3);
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(1);
  });

  it('refreshes CSRF once after HTTP 419 and retries', async () => {
    const httpClient = createHttpClient();
    let refreshes = 0;
    const transport: HttpClient = {
      request: httpClient.request.bind(httpClient),
      csrf: {
        ensure: () => httpClient.csrf.ensure(),
        getToken: () => httpClient.csrf.getToken(),
        clear: () => httpClient.csrf.clear(),
        refresh: () => {
          refreshes += 1;
          return httpClient.csrf.refresh();
        },
      },
    };
    const { client, session } = createSubject(() => Promise.resolve(), transport);
    session.startSession();

    let csrfLoads = 0;
    const tokens: Array<string | null> = [];
    server.use(
      http.get(pathnameIs('/csrf'), () => {
        csrfLoads += 1;
        return csrfResponse(csrfLoads === 1 ? 'token-1' : 'token-2');
      }),
      http.post(pathnameIs('/v1/items'), async ({ request }) => {
        tokens.push(request.headers.get('X-CSRF-TOKEN'));
        if (tokens.length === 1) {
          return tokenMismatch();
        }

        return HttpResponse.json({ saved: true });
      }),
    );

    await expect(
      client.request({
        method: 'POST',
        path: '/v1/items',
        body: { url: 'https://example.com' },
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({ saved: true });

    expect(refreshes).toBe(1);
    expect(csrfLoads).toBe(2);
    expect(tokens).toEqual(['token-1', 'token-2']);
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(0);
  });

  it('retries a late HTTP 419 without a second CSRF refresh', async () => {
    const httpClient = createHttpClient();
    let refreshes = 0;
    const transport: HttpClient = {
      request: httpClient.request.bind(httpClient),
      csrf: {
        ensure: () => httpClient.csrf.ensure(),
        getToken: () => httpClient.csrf.getToken(),
        clear: () => httpClient.csrf.clear(),
        refresh: () => {
          refreshes += 1;
          return httpClient.csrf.refresh();
        },
      },
    };
    const { client, session } = createSubject(() => Promise.resolve(), transport);
    session.startSession();

    const releaseLate = createDeferred();
    const lateArrived = createDeferred();
    let csrfLoads = 0;
    let earlyCalls = 0;
    let lateCalls = 0;
    const tokens: Array<string | null> = [];

    server.use(
      http.get(pathnameIs('/csrf'), () => {
        csrfLoads += 1;
        return csrfResponse(csrfLoads === 1 ? 'token-1' : 'token-2');
      }),
      http.post(pathnameIs('/v1/items'), async ({ request }) => {
        tokens.push(request.headers.get('X-CSRF-TOKEN'));
        if (request.headers.get('X-Request-Id') === 'late') {
          lateCalls += 1;
          if (lateCalls === 1) {
            lateArrived.resolve();
            await releaseLate.promise;
            return tokenMismatch();
          }

          return HttpResponse.json({ id: 'late' });
        }

        earlyCalls += 1;
        if (earlyCalls === 1) {
          return tokenMismatch();
        }

        return HttpResponse.json({ id: 'early' });
      }),
    );

    const late = client.request({
      method: 'POST',
      path: '/v1/items',
      body: { n: 1 },
      headers: { 'X-Request-Id': 'late' },
    });
    await lateArrived.promise;

    await expect(
      client.request({
        method: 'POST',
        path: '/v1/items',
        body: { n: 2 },
        headers: { 'X-Request-Id': 'early' },
      }),
    ).resolves.toEqual({ id: 'early' });
    expect(refreshes).toBe(1);
    expect(csrfLoads).toBe(2);

    releaseLate.resolve();
    await expect(late).resolves.toEqual({ id: 'late' });
    expect(refreshes).toBe(1);
    expect(csrfLoads).toBe(2);
    expect(lateCalls).toBe(2);
    expect(tokens).toEqual(['token-1', 'token-1', 'token-2', 'token-2']);
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(0);
  });

  it('shares one CSRF refresh across concurrent HTTP 419 responses', async () => {
    const httpClient = createHttpClient();
    const releaseRefresh = createDeferred();
    const refreshStarted = createDeferred();
    let refreshes = 0;
    const transport: HttpClient = {
      request: httpClient.request.bind(httpClient),
      csrf: {
        ensure: () => httpClient.csrf.ensure(),
        getToken: () => httpClient.csrf.getToken(),
        clear: () => httpClient.csrf.clear(),
        refresh: () => {
          refreshes += 1;
          refreshStarted.resolve();
          return releaseRefresh.promise.then(() => httpClient.csrf.refresh());
        },
      },
    };
    const { client, session } = createSubject(() => Promise.resolve(), transport);
    session.startSession();

    let calls = 0;
    const bothRejected = createDeferred();
    server.use(
      http.post(pathnameIs('/v1/items'), () => {
        calls += 1;
        if (calls <= 2) {
          if (calls === 2) {
            bothRejected.resolve();
          }
          return tokenMismatch();
        }

        return HttpResponse.json({ ok: true });
      }),
    );

    const pending = Promise.all([
      client.request({ method: 'POST', path: '/v1/items', body: { n: 1 } }),
      client.request({ method: 'POST', path: '/v1/items', body: { n: 2 } }),
    ]);

    await bothRejected.promise;
    await refreshStarted.promise;
    expect(refreshes).toBe(1);

    releaseRefresh.resolve();
    await pending;

    expect(refreshes).toBe(1);
    expect(calls).toBe(4);
    expect(session.getGeneration()).toBe(0);
  });

  it('stops after one HTTP 419 recovery attempt', async () => {
    const httpClient = createHttpClient();
    let refreshes = 0;
    const transport: HttpClient = {
      request: httpClient.request.bind(httpClient),
      csrf: {
        ensure: () => httpClient.csrf.ensure(),
        getToken: () => httpClient.csrf.getToken(),
        clear: () => httpClient.csrf.clear(),
        refresh: () => {
          refreshes += 1;
          return httpClient.csrf.refresh();
        },
      },
    };
    let rotations = 0;
    const { client, session, reasons } = createSubject(() => {
      rotations += 1;
      return Promise.resolve();
    }, transport);
    session.startSession();

    let calls = 0;
    server.use(
      http.post(pathnameIs('/v1/items'), () => {
        calls += 1;
        return tokenMismatch();
      }),
    );

    const error = await client
      .request({
        method: 'POST',
        path: '/v1/items',
        body: { url: 'https://example.com' },
      })
      .then(
        () => {
          throw new Error('Expected the request to fail.');
        },
        (caught: unknown) => caught,
      );

    expect(error).toBeInstanceOf(HttpError);
    if (!(error instanceof HttpError)) {
      throw new Error('Expected HttpError.');
    }

    expect(error.status).toBe(419);
    expect(calls).toBe(2);
    expect(refreshes).toBe(1);
    expect(rotations).toBe(0);
    expect(session.isActive()).toBe(true);
    expect(reasons).toEqual([]);
  });

  it('propagates HTTP 422 without auth or CSRF recovery', async () => {
    const httpClient = createHttpClient();
    let refreshes = 0;
    const transport: HttpClient = {
      request: httpClient.request.bind(httpClient),
      csrf: {
        ensure: () => httpClient.csrf.ensure(),
        getToken: () => httpClient.csrf.getToken(),
        clear: () => httpClient.csrf.clear(),
        refresh: () => {
          refreshes += 1;
          return httpClient.csrf.refresh();
        },
      },
    };
    let rotations = 0;
    const { client, session } = createSubject(() => {
      rotations += 1;
      return Promise.resolve();
    }, transport);
    session.startSession();

    let calls = 0;
    server.use(
      http.post(pathnameIs('/v1/items'), () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              type: 'ValidationException',
              message: 'The given data was invalid.',
              payload: {
                url: ['The url must be a valid URL.'],
              },
            },
          },
          { status: 422 },
        );
      }),
    );

    const error = await client
      .request({
        method: 'POST',
        path: '/v1/items',
        body: { url: 'not-a-url' },
      })
      .then(
        () => {
          throw new Error('Expected the request to fail.');
        },
        (caught: unknown) => caught,
      );

    expect(error).toBeInstanceOf(HttpError);
    if (!(error instanceof HttpError)) {
      throw new Error('Expected HttpError.');
    }

    expect(error.status).toBe(422);
    expect(error.errorType).toBe('ValidationException');
    expect(error.fieldErrors).toEqual({
      url: ['The url must be a valid URL.'],
    });
    expect(calls).toBe(1);
    expect(rotations).toBe(0);
    expect(refreshes).toBe(0);
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(0);
  });

  it('allows one CSRF refresh and one session rotation in the same call', async () => {
    const httpClient = createHttpClient();
    let refreshes = 0;
    const transport: HttpClient = {
      request: httpClient.request.bind(httpClient),
      csrf: {
        ensure: () => httpClient.csrf.ensure(),
        getToken: () => httpClient.csrf.getToken(),
        clear: () => httpClient.csrf.clear(),
        refresh: () => {
          refreshes += 1;
          return httpClient.csrf.refresh();
        },
      },
    };
    let rotations = 0;
    const { client, session } = createSubject(() => {
      rotations += 1;
      return Promise.resolve();
    }, transport);
    session.startSession();

    let calls = 0;
    server.use(
      http.post(pathnameIs('/v1/items'), () => {
        calls += 1;
        if (calls === 1) {
          return tokenMismatch();
        }
        if (calls === 2) {
          return unauthorized();
        }

        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(
      client.request({
        method: 'POST',
        path: '/v1/items',
        body: { url: 'https://example.com' },
      }),
    ).resolves.toEqual({ ok: true });

    expect(calls).toBe(3);
    expect(refreshes).toBe(1);
    expect(rotations).toBe(1);
    expect(session.isActive()).toBe(true);
    expect(session.getGeneration()).toBe(1);
  });
});
