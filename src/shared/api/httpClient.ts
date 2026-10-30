import { createCsrfManager, type CsrfManager } from './csrf';
import { httpErrorFromResponse } from './errors';

const REQUESTED_WITH_HEADER = 'X-Requested-With';
const REQUESTED_WITH_VALUE = 'XMLHttpRequest';
const CSRF_HEADER = 'X-CSRF-TOKEN';
const JSON_CONTENT_TYPE = 'application/json';
const CSRF_PATH = '/csrf';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpRequestOptions = {
  path: string;
  method?: HttpMethod;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Called with the CSRF token attached to this attempt, after CSRF initialization.
   * The argument is undefined when this attempt does not send a CSRF token.
   */
  onCsrfToken?: (token: string | undefined) => void;
};

export type ResponseParser<TResponse> = (value: unknown) => TResponse;

export type HttpRequest = {
  (options: HttpRequestOptions): Promise<unknown>;
  <TResponse>(options: HttpRequestOptions, parse: ResponseParser<TResponse>): Promise<TResponse | undefined>;
};

export type HttpClient = {
  request: HttpRequest;
  csrf: CsrfManager;
};

export type HttpClientOptions = {
  fetch?: typeof fetch;
};

type HeaderOptions = {
  headers?: HeadersInit;
  jsonBody: boolean;
  csrfToken?: string;
};

function resolveSameOriginUrl(path: string): string {
  if (!isRootRelativePath(path)) {
    throw new Error('Only root-relative API paths are allowed.');
  }

  const url = new URL(path, globalThis.location.origin);
  if (url.origin !== globalThis.location.origin) {
    throw new Error('Only root-relative API paths are allowed.');
  }

  return url.href;
}

function isRootRelativePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

function createHeaders(options: HeaderOptions): Headers {
  const headers = new Headers(options.headers);
  headers.set(REQUESTED_WITH_HEADER, REQUESTED_WITH_VALUE);

  if (options.csrfToken !== undefined) {
    headers.set(CSRF_HEADER, options.csrfToken);
  }

  if (options.jsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', JSON_CONTENT_TYPE);
  }

  return headers;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal === undefined || !signal.aborted) {
    return;
  }

  const reason: unknown = signal.reason;
  if (reason instanceof DOMException && reason.name === 'AbortError') {
    throw reason;
  }

  throw new DOMException('The operation was aborted.', 'AbortError');
}

function sendsJsonBody(method: HttpMethod, body: unknown): boolean {
  return body !== undefined && method !== 'GET';
}

async function readSuccessBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (text.trim() === '') {
    return undefined;
  }

  const value: unknown = JSON.parse(text);
  return value;
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const fetchOverride = options.fetch;

  function resolveFetch(): typeof fetch {
    return fetchOverride ?? globalThis.fetch.bind(globalThis);
  }

  // request() waits for CSRF initialization, so this fetch must stay outside it.
  async function fetchCsrfToken(): Promise<string> {
    const response = await resolveFetch()(resolveSameOriginUrl(CSRF_PATH), {
      method: 'GET',
      headers: createHeaders({ jsonBody: false }),
    });

    if (response.status !== 204) {
      throw await httpErrorFromResponse(response);
    }

    await response.text();

    const token = response.headers.get(CSRF_HEADER);
    if (token === null || token.trim() === '') {
      throw new Error('CSRF response is missing the X-CSRF-TOKEN header.');
    }

    return token;
  }

  const csrf = createCsrfManager({
    loadToken: fetchCsrfToken,
  });

  function request(requestOptions: HttpRequestOptions): Promise<unknown>;
  function request<TResponse>(
    requestOptions: HttpRequestOptions,
    parse: ResponseParser<TResponse>,
  ): Promise<TResponse | undefined>;
  async function request(requestOptions: HttpRequestOptions, parse?: (value: unknown) => unknown): Promise<unknown> {
    throwIfAborted(requestOptions.signal);
    const url = resolveSameOriginUrl(requestOptions.path);
    await csrf.ensure();
    throwIfAborted(requestOptions.signal);

    const method = requestOptions.method ?? 'GET';
    const jsonBody = sendsJsonBody(method, requestOptions.body);
    const csrfToken = method === 'POST' || method === 'PUT' ? readToken(csrf) : undefined;
    requestOptions.onCsrfToken?.(csrfToken);
    const headers = createHeaders({
      headers: requestOptions.headers,
      jsonBody,
      csrfToken,
    });

    const response = await resolveFetch()(url, {
      method,
      headers,
      body: jsonBody ? JSON.stringify(requestOptions.body) : undefined,
      signal: requestOptions.signal,
    });

    if (!response.ok) {
      throw await httpErrorFromResponse(response);
    }

    const value = await readSuccessBody(response);
    if (value === undefined || parse === undefined) {
      return value;
    }

    return parse(value);
  }

  return { request, csrf };
}

function readToken(csrf: CsrfManager): string {
  const token = csrf.getToken();
  if (token === null) {
    throw new Error('CSRF token is missing.');
  }

  return token;
}
