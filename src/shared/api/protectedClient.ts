import { HttpError } from './errors';
import type { HttpClient, HttpRequest, HttpRequestOptions, ResponseParser } from './httpClient';
import type { SessionManager } from '../session/sessionManager.types';

// Per call: at most one 419 retry and one 401 retry.
const AUTH_RECOVERY_LIMIT = 1;
const CSRF_RECOVERY_LIMIT = 1;

export type ProtectedClient = {
  request: HttpRequest;
};

export type ProtectedClientOptions = {
  http: HttpClient;
  session: SessionManager;
};

export function createProtectedClient(options: ProtectedClientOptions): ProtectedClient {
  const { http, session } = options;
  let csrfRefresh: Promise<void> | null = null;

  function refreshCsrf(): Promise<void> {
    if (csrfRefresh !== null) {
      return csrfRefresh;
    }

    const promise = http.csrf.refresh();
    csrfRefresh = promise;

    const clearIfCurrent = (): void => {
      if (csrfRefresh === promise) {
        csrfRefresh = null;
      }
    };

    void promise.then(clearIfCurrent, clearIfCurrent);

    return promise;
  }

  function request(requestOptions: HttpRequestOptions): Promise<unknown>;
  function request<TResponse>(
    requestOptions: HttpRequestOptions,
    parse: ResponseParser<TResponse>,
  ): Promise<TResponse | undefined>;
  async function request(requestOptions: HttpRequestOptions, parse?: (value: unknown) => unknown): Promise<unknown> {
    if (!session.isActive()) {
      throw new Error('Cannot send a protected request without an active session.');
    }

    const epoch = session.getAuthEpoch();
    const generation = session.getGeneration();
    let authBudget = AUTH_RECOVERY_LIMIT;
    let csrfBudget = CSRF_RECOVERY_LIMIT;

    while (true) {
      throwIfAborted(requestOptions.signal);
      assertCurrentSession(session, epoch);

      let sentCsrfToken: string | undefined;
      const attemptOptions: HttpRequestOptions = {
        ...requestOptions,
        onCsrfToken: (token) => {
          sentCsrfToken = token;
          requestOptions.onCsrfToken?.(token);
        },
      };

      try {
        const value =
          parse === undefined ? await http.request(attemptOptions) : await http.request(attemptOptions, parse);

        throwIfAborted(requestOptions.signal);
        assertCurrentSession(session, epoch);
        return value;
      } catch (error) {
        if (isAbortError(error) || !(error instanceof HttpError)) {
          throw error;
        }

        if (error.status === 419 && csrfBudget > 0) {
          csrfBudget -= 1;
          if (sentCsrfToken !== undefined && sentCsrfToken !== http.csrf.getToken()) {
            continue;
          }

          await recoverCsrf(session, epoch, requestOptions.signal, refreshCsrf);
          continue;
        }

        if (error.status === 401 && authBudget > 0) {
          authBudget -= 1;
          await recoverAuthentication(session, epoch, generation, requestOptions.signal);
          continue;
        }

        if (error.status === 401) {
          invalidateIfCurrent(session, epoch);
        }

        throw error;
      }
    }
  }

  return { request };
}

async function recoverCsrf(
  session: SessionManager,
  epoch: number,
  signal: AbortSignal | undefined,
  refreshCsrf: () => Promise<void>,
): Promise<void> {
  throwIfAborted(signal);
  assertCurrentSession(session, epoch);
  await refreshCsrf();
  throwIfAborted(signal);
  assertCurrentSession(session, epoch);
}

async function recoverAuthentication(
  session: SessionManager,
  epoch: number,
  generation: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  throwIfAborted(signal);
  assertCurrentSession(session, epoch);

  if (session.getGeneration() === generation) {
    try {
      await waitForRotation(session, signal);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      invalidateIfCurrent(session, epoch);
      throw error;
    }
  }

  throwIfAborted(signal);
  assertCurrentSession(session, epoch);
}

function waitForRotation(session: SessionManager, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    throw abortError(signal);
  }

  const rotation = session.rotate();
  if (signal === undefined) {
    return rotation;
  }

  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort);
      void rotation.catch(() => undefined);
      reject(abortError(signal));
    };

    signal.addEventListener('abort', onAbort, { once: true });
    rotation.then(
      () => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function assertCurrentSession(session: SessionManager, epoch: number): void {
  if (!session.isActive() || session.getAuthEpoch() !== epoch) {
    throw new Error('Protected request is stale.');
  }
}

function invalidateIfCurrent(session: SessionManager, epoch: number): void {
  if (session.isActive() && session.getAuthEpoch() === epoch) {
    session.invalidate('authentication-failed');
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal === undefined || !signal.aborted) {
    return;
  }

  throw abortError(signal);
}

function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (isAbortError(reason) && reason instanceof Error) {
    return reason;
  }

  return new DOMException('The operation was aborted.', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
