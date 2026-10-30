import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { createHttpClient, type HttpClient } from './httpClient';
import { HttpError } from './errors';

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

function createClient(): HttpClient {
  return createHttpClient();
}

function csrfResponse(token: string) {
  return new HttpResponse(null, {
    status: 204,
    headers: {
      'X-CSRF-TOKEN': token,
    },
  });
}

describe('createHttpClient', () => {
  it('initializes CSRF before the first API request', async () => {
    const client = createClient();
    const csrfSeen = createDeferred();
    const csrfReady = createDeferred();
    let apiStarted = false;

    server.use(
      http.get(pathnameIs('/csrf'), () => {
        csrfSeen.resolve();
        return csrfReady.promise.then(() => csrfResponse('csrf-token'));
      }),
      http.get(pathnameIs('/api/items'), () => {
        apiStarted = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    const pending = client.request({ path: '/api/items' });

    await csrfSeen.promise;
    expect(apiStarted).toBe(false);

    csrfReady.resolve();
    await expect(pending).resolves.toEqual({ ok: true });
    expect(apiStarted).toBe(true);
  });

  it('sends X-Requested-With on GET /csrf', async () => {
    const client = createClient();
    let requestedWith: string | null = null;

    server.use(
      http.get(pathnameIs('/csrf'), ({ request }) => {
        requestedWith = request.headers.get('X-Requested-With');
        return csrfResponse('csrf-token');
      }),
      http.get(pathnameIs('/api/items'), () => HttpResponse.json({ ok: true })),
    );

    await client.request({ path: '/api/items' });

    expect(requestedWith).toBe('XMLHttpRequest');
  });

  it('invokes GET /csrf once for concurrent initial requests', async () => {
    const client = createClient();
    const csrfReady = createDeferred();
    let csrfCalls = 0;

    server.use(
      http.get(pathnameIs('/csrf'), () => {
        csrfCalls += 1;
        return csrfReady.promise.then(() => csrfResponse('shared-token'));
      }),
      http.get(pathnameIs('/api/items'), () => HttpResponse.json({ ok: true })),
      http.get(pathnameIs('/api/other'), () => HttpResponse.json({ ok: true })),
    );

    const pending = Promise.all([
      client.request({ path: '/api/items' }),
      client.request({ path: '/api/other' }),
      client.request({ path: '/api/items' }),
    ]);

    csrfReady.resolve();
    await pending;

    expect(csrfCalls).toBe(1);
    expect(client.csrf.getToken()).toBe('shared-token');
  });

  it('reuses the CSRF token after initialization', async () => {
    const client = createClient();
    let csrfCalls = 0;

    server.use(
      http.get(pathnameIs('/csrf'), () => {
        csrfCalls += 1;
        return csrfResponse('cached-token');
      }),
      http.get(pathnameIs('/api/items'), () => HttpResponse.json({ ok: true })),
    );

    await client.request({ path: '/api/items' });
    await client.request({ path: '/api/items' });

    expect(csrfCalls).toBe(1);
    expect(client.csrf.getToken()).toBe('cached-token');
  });

  it('retries CSRF initialization after a failure', async () => {
    const client = createClient();
    let csrfCalls = 0;
    let apiCalls = 0;

    server.use(
      http.get(pathnameIs('/csrf'), () => {
        csrfCalls += 1;
        if (csrfCalls === 1) {
          return HttpResponse.json(
            {
              error: {
                type: 'TokenMismatchException',
                message: 'CSRF token missing.',
              },
            },
            { status: 419 },
          );
        }

        return csrfResponse('token-after-retry');
      }),
      http.post(pathnameIs('/api/items'), ({ request }) => {
        apiCalls += 1;
        return HttpResponse.json({
          csrf: request.headers.get('X-CSRF-TOKEN'),
        });
      }),
    );

    await expect(
      client.request({
        method: 'POST',
        path: '/api/items',
        body: { url: 'https://example.com' },
      }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(apiCalls).toBe(0);
    expect(client.csrf.getToken()).toBeNull();

    await expect(
      client.request({
        method: 'POST',
        path: '/api/items',
        body: { url: 'https://example.com' },
      }),
    ).resolves.toEqual({
      csrf: 'token-after-retry',
    });

    expect(csrfCalls).toBe(2);
    expect(apiCalls).toBe(1);
    expect(client.csrf.getToken()).toBe('token-after-retry');
  });

  it('sends the CSRF token and JSON content type on POST and PUT', async () => {
    const client = createClient();
    const seen: Array<{
      method: string;
      csrf: string | null;
      contentType: string | null;
      requestedWith: string | null;
      trace: string | null;
      body: unknown;
    }> = [];

    server.use(
      http.post(pathnameIs('/api/items'), async ({ request }) => {
        seen.push({
          method: request.method,
          csrf: request.headers.get('X-CSRF-TOKEN'),
          contentType: request.headers.get('Content-Type'),
          requestedWith: request.headers.get('X-Requested-With'),
          trace: request.headers.get('X-Trace-Id'),
          body: await request.json(),
        });
        return HttpResponse.json({ id: 'item-1' }, { status: 201 });
      }),
      http.put(pathnameIs('/api/items/item-1'), async ({ request }) => {
        seen.push({
          method: request.method,
          csrf: request.headers.get('X-CSRF-TOKEN'),
          contentType: request.headers.get('Content-Type'),
          requestedWith: request.headers.get('X-Requested-With'),
          trace: request.headers.get('X-Trace-Id'),
          body: await request.json(),
        });
        return HttpResponse.json({ id: 'item-1' });
      }),
    );

    await client.request({
      method: 'POST',
      path: '/api/items',
      headers: { 'X-Trace-Id': 'trace-1' },
      body: { url: 'https://example.com' },
    });
    await client.request({
      method: 'PUT',
      path: '/api/items/item-1',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { url: 'https://example.com/updated' },
    });

    expect(seen).toEqual([
      {
        method: 'POST',
        csrf: 'mock-csrf-token',
        contentType: 'application/json',
        requestedWith: 'XMLHttpRequest',
        trace: 'trace-1',
        body: { url: 'https://example.com' },
      },
      {
        method: 'PUT',
        csrf: 'mock-csrf-token',
        contentType: 'application/json; charset=utf-8',
        requestedWith: 'XMLHttpRequest',
        trace: null,
        body: { url: 'https://example.com/updated' },
      },
    ]);
  });

  it('does not set a JSON content type on GET', async () => {
    const client = createClient();
    let contentType: string | null = 'unset';
    let csrf: string | null = 'unset';
    let accept: string | null = null;

    server.use(
      http.get(pathnameIs('/api/items'), ({ request }) => {
        contentType = request.headers.get('Content-Type');
        csrf = request.headers.get('X-CSRF-TOKEN');
        accept = request.headers.get('Accept');
        return HttpResponse.json({ ok: true });
      }),
    );

    await client.request({
      path: '/api/items',
      headers: { Accept: 'application/json' },
    });

    expect(contentType).toBeNull();
    expect(csrf).toBeNull();
    expect(accept).toBe('application/json');
  });

  it('reports the CSRF token attached after initialization', async () => {
    const client = createClient();
    const observed: Array<string | undefined> = [];

    server.use(
      http.post(pathnameIs('/api/items'), ({ request }) => {
        return HttpResponse.json({ csrf: request.headers.get('X-CSRF-TOKEN') });
      }),
      http.get(pathnameIs('/api/items'), ({ request }) => {
        return HttpResponse.json({ csrf: request.headers.get('X-CSRF-TOKEN') });
      }),
    );

    await expect(
      client.request({
        method: 'POST',
        path: '/api/items',
        body: { url: 'https://example.com' },
        onCsrfToken: (token) => {
          observed.push(token);
        },
      }),
    ).resolves.toEqual({ csrf: 'mock-csrf-token' });

    await client.request({
      path: '/api/items',
      onCsrfToken: (token) => {
        observed.push(token);
      },
    });

    expect(observed).toEqual(['mock-csrf-token', undefined]);
  });

  it('returns undefined for HTTP 204 without parsing JSON', async () => {
    const client = createClient();

    server.use(
      http.get(pathnameIs('/api/items/item-1'), () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(client.request({ path: '/api/items/item-1' })).resolves.toBeUndefined();
  });

  it('preserves validation errors from HTTP 422', async () => {
    const client = createClient();
    const payload = {
      url: ['The url must be a valid URL.'],
    };

    server.use(
      http.post(pathnameIs('/api/items'), () => {
        return HttpResponse.json(
          {
            error: {
              type: 'ValidationException',
              message: 'The given data was invalid.',
              payload,
            },
          },
          { status: 422 },
        );
      }),
    );

    const error = await client
      .request({
        method: 'POST',
        path: '/api/items',
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
    expect(error.message).toBe('The given data was invalid.');
    expect(error.errorType).toBe('ValidationException');
    expect(error.fieldErrors).toEqual(payload);
    expect(error.payload).toEqual(payload);
  });

  it('returns HTTP 401 and 419 as typed errors without retrying', async () => {
    const client = createClient();
    const calls = new Map<number, number>();

    server.use(
      http.get(pathnameIs('/api/session'), () => {
        calls.set(401, (calls.get(401) ?? 0) + 1);
        return HttpResponse.json(
          {
            error: {
              type: 'AuthenticationException',
              message: 'Unauthenticated.',
            },
          },
          { status: 401 },
        );
      }),
      http.post(pathnameIs('/api/items'), () => {
        calls.set(419, (calls.get(419) ?? 0) + 1);
        return HttpResponse.json(
          {
            error: {
              type: 'TokenMismatchException',
              message: 'CSRF token mismatch.',
            },
          },
          { status: 419 },
        );
      }),
    );

    const unauthorized = await client.request({ path: '/api/session' }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );
    const mismatch = await client
      .request({
        method: 'POST',
        path: '/api/items',
        body: { url: 'https://example.com' },
      })
      .then(
        () => {
          throw new Error('Expected the request to fail.');
        },
        (caught: unknown) => caught,
      );

    expect(unauthorized).toBeInstanceOf(HttpError);
    expect(mismatch).toBeInstanceOf(HttpError);
    if (!(unauthorized instanceof HttpError) || !(mismatch instanceof HttpError)) {
      throw new Error('Expected HttpError.');
    }

    expect(unauthorized.status).toBe(401);
    expect(unauthorized.errorType).toBe('AuthenticationException');
    expect(unauthorized.message).toBe('Unauthenticated.');
    expect(mismatch.status).toBe(419);
    expect(mismatch.errorType).toBe('TokenMismatchException');
    expect(mismatch.message).toBe('CSRF token mismatch.');
    expect(calls.get(401)).toBe(1);
    expect(calls.get(419)).toBe(1);
    expect(client.csrf.getToken()).toBe('mock-csrf-token');
  });

  it('represents 400 and 404 backend errors', async () => {
    const client = createClient();

    server.use(
      http.get(pathnameIs('/api/items/missing'), () => {
        return HttpResponse.json(
          {
            error: {
              type: 'NotFoundException',
              message: 'Resource not found.',
            },
          },
          { status: 404 },
        );
      }),
      http.post(pathnameIs('/api/items'), () => {
        return HttpResponse.json(
          {
            error: {
              type: 'BadRequestException',
              message: 'Bad request.',
              payload: { reason: 'malformed' },
            },
          },
          { status: 400 },
        );
      }),
    );

    const missing = await client.request({ path: '/api/items/missing' }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );
    const badRequest = await client.request({ method: 'POST', path: '/api/items', body: { url: '' } }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(missing).toBeInstanceOf(HttpError);
    expect(badRequest).toBeInstanceOf(HttpError);
    if (!(missing instanceof HttpError) || !(badRequest instanceof HttpError)) {
      throw new Error('Expected HttpError.');
    }

    expect(missing.status).toBe(404);
    expect(missing.errorType).toBe('NotFoundException');
    expect(missing.fieldErrors).toBeUndefined();
    expect(badRequest.status).toBe(400);
    expect(badRequest.errorType).toBe('BadRequestException');
    expect(badRequest.fieldErrors).toBeUndefined();
    expect(badRequest.payload).toEqual({ reason: 'malformed' });
  });

  it('does not crash when an error body is not JSON', async () => {
    const client = createClient();

    server.use(
      http.get(pathnameIs('/api/items'), () => {
        return new HttpResponse('<html>unavailable</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        });
      }),
    );

    const error = await client.request({ path: '/api/items' }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HttpError);
    if (!(error instanceof HttpError)) {
      throw new Error('Expected HttpError.');
    }

    expect(error.status).toBe(502);
    expect(error.message).toBe('HTTP 502');
    expect(error.errorType).toBeUndefined();
    expect(error.fieldErrors).toBeUndefined();
    expect(error.payload).toBeUndefined();
  });

  it('propagates AbortSignal cancellation', async () => {
    const client = createClient();
    const aborted = new AbortController();
    aborted.abort();

    await expect(client.request({ path: '/api/items', signal: aborted.signal })).rejects.toSatisfy(isAbortError);

    const started = createDeferred();
    server.use(
      http.get(pathnameIs('/api/items'), async ({ request }) => {
        started.resolve();
        await new Promise<void>((resolve) => {
          if (request.signal.aborted) {
            resolve();
            return;
          }

          request.signal.addEventListener('abort', () => resolve(), {
            once: true,
          });
        });
        return HttpResponse.json({ ok: true });
      }),
    );

    const controller = new AbortController();
    const pending = client.request({
      path: '/api/items',
      signal: controller.signal,
    });
    await started.promise;
    controller.abort();

    await expect(pending).rejects.toSatisfy(isAbortError);
    await expect(pending).rejects.not.toBeInstanceOf(HttpError);
  });

  it('leaves network failures distinct from HTTP errors', async () => {
    const client = createClient();

    server.use(http.get(pathnameIs('/api/items'), () => HttpResponse.error()));

    const error = await client.request({ path: '/api/items' }).then(
      () => {
        throw new Error('Expected the request to fail.');
      },
      (caught: unknown) => caught,
    );

    expect(error).not.toBeInstanceOf(HttpError);
    expect(error).toBeInstanceOf(TypeError);
  });

  it('accepts root-relative paths and rejects other URL forms', async () => {
    const client = createClient();
    const rejectedPaths = [
      'https://evil.test/v1/me',
      'http://localhost:3000/v1/me',
      '//evil.test/v1/me',
      '?page=1',
      '#section',
      'v1/me',
      '/\\evil.test',
    ];

    for (const path of rejectedPaths) {
      await expect(client.request({ path })).rejects.toThrow('Only root-relative API paths are allowed.');
    }

    server.use(
      http.get(pathnameIs('/v1/me'), ({ request }) => {
        return HttpResponse.json({
          path: new URL(request.url).pathname,
          query: new URL(request.url).search,
        });
      }),
    );

    await expect(client.request({ path: '/v1/me' })).resolves.toEqual({
      path: '/v1/me',
      query: '',
    });
    await expect(client.request({ path: '/v1/me?active=true' })).resolves.toEqual({
      path: '/v1/me',
      query: '?active=true',
    });
  });
});
