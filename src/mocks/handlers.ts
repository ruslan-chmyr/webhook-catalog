import { http, HttpResponse } from 'msw';
import { acceptLogin, issueSession, readCurrentUser, revokeSession, rotateSession, type MockResult } from './authState';
import { listWebhooks, readWebhook, updateWebhook } from './webhooks';

export const mockCsrfToken = 'mock-csrf-token';

export const handlers = [
  http.get(pathnameIs('/csrf'), () => {
    return new HttpResponse(null, {
      status: 204,
      headers: {
        'X-CSRF-TOKEN': mockCsrfToken,
      },
    });
  }),
  http.post(pathnameIs('/auth/login'), async ({ request }) => {
    const body = await readRecord(request);
    return jsonResult(
      acceptLogin({
        email: readString(body, 'email'),
        password: readString(body, 'password'),
        fingerprint: readString(body, 'fingerprint'),
        captcha: request.headers.get('X-Captcha-Token'),
      }),
    );
  }),
  http.post(pathnameIs('/auth/token/issue'), async ({ request }) => {
    const body = await readRecord(request);
    return jsonResult(
      await issueSession({
        deviceSessionToken: readString(body, 'device_session_token'),
        fingerprint: readString(body, 'fingerprint'),
      }),
    );
  }),
  http.post(pathnameIs('/auth/token/rotate'), async ({ request }) => {
    const body = await readRecord(request);
    return jsonResult(await rotateSession(readString(body, 'fingerprint')));
  }),
  http.post(pathnameIs('/auth/token/revoke'), async ({ request }) => {
    const body = await readRecord(request);
    await revokeSession(readString(body, 'fingerprint'));
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(pathnameIs('/v1/me'), () => {
    return jsonResult(readCurrentUser());
  }),
  http.get(pathnameIs('/v1/webhooks'), ({ request }) => {
    return jsonResult(listWebhooks(new URL(request.url)));
  }),
  http.get(
    ({ request }) => webhookIdFrom(request) !== undefined,
    ({ request }) => {
      const id = webhookIdFrom(request);
      return jsonResult(readWebhook(id ?? ''));
    },
  ),
  http.put(
    ({ request }) => webhookIdFrom(request) !== undefined,
    async ({ request }) => {
      const id = webhookIdFrom(request);
      return jsonResult(updateWebhook(id ?? '', await readRecord(request)));
    },
  ),
];

function pathnameIs(pathname: string): (args: { request: Request }) => boolean {
  return ({ request }) => new URL(request.url).pathname === pathname;
}

function webhookIdFrom(request: Request): string | undefined {
  const match = new URL(request.url).pathname.match(/^\/v1\/webhooks\/([^/]+)$/);
  const id = match?.[1];
  if (id === undefined || id === '') {
    return undefined;
  }

  return decodeURIComponent(id);
}

function jsonResult<T>(result: MockResult<T>): Response {
  if (!result.ok) {
    return HttpResponse.json(
      {
        error: {
          type: result.type,
          message: result.message,
          ...(result.fieldErrors === undefined ? {} : { payload: result.fieldErrors }),
        },
      },
      { status: result.status },
    );
  }

  if (result.value === null) {
    return new HttpResponse(null, { status: 204 });
  }

  return HttpResponse.json(result.value);
}

async function readRecord(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.trim() === '') {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
