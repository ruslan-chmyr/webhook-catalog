import { establishSession, http, protectedClient, session } from '@/app/composition';
import { HttpError } from '@/shared/api/errors';
import { clearDeviceSessionToken, getDeviceSessionToken, rememberDeviceSessionToken } from '../model/deviceSession';
import { getOrCreateFingerprint } from '../model/fingerprint';
import { parseCurrentUser, type CurrentUser } from '../model/currentUser';

export const developmentCaptchaToken = 'development-captcha-token';

export type LoginInput = {
  email: string;
  password: string;
};

let loginAttempt = 0;
let revokeChain: Promise<void> = Promise.resolve();

export function resetAuthFlow(): void {
  loginAttempt = 0;
  revokeChain = Promise.resolve();
}

export async function login(input: LoginInput): Promise<void> {
  const attempt = ++loginAttempt;
  const fingerprint = getOrCreateFingerprint();
  await waitForRevokes();
  assertCurrentAttempt(attempt);

  const deviceSessionToken = await http.request(
    {
      method: 'POST',
      path: '/auth/login',
      headers: { 'X-Captcha-Token': developmentCaptchaToken },
      body: {
        email: input.email,
        password: input.password,
        fingerprint,
      },
    },
    parseDeviceSessionToken,
  );

  assertCurrentAttempt(attempt);

  if (deviceSessionToken === undefined) {
    throw new Error('Login response is missing a device session token.');
  }

  await waitForRevokes();
  assertCurrentAttempt(attempt);

  try {
    await http.request({
      method: 'POST',
      path: '/auth/token/issue',
      body: {
        device_session_token: deviceSessionToken,
        fingerprint,
      },
    });
  } catch (error) {
    if (attempt !== loginAttempt) {
      throw new Error('Login attempt is obsolete.');
    }

    clearDeviceSessionToken();
    throw error;
  }

  assertCurrentAttempt(attempt);
  rememberDeviceSessionToken(deviceSessionToken);
  establishSession();
}

export async function logout(): Promise<void> {
  loginAttempt += 1;

  if (session.isActive()) {
    session.invalidate('logout');
  }

  try {
    await enqueueRevoke();
  } catch {
    // The local session is already over. The login screen does not wait on revoke.
  }
}

export async function loadCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const user = await protectedClient.request({ path: '/v1/me', signal }, parseCurrentUser);
  if (user === undefined) {
    throw new Error('Current user response was empty.');
  }

  return user;
}

export function readDeviceSessionToken(): string | null {
  return getDeviceSessionToken();
}

function enqueueRevoke(): Promise<void> {
  const revoke = revokeChain.then(revokeSession, revokeSession);
  revokeChain = revoke.then(
    () => undefined,
    () => undefined,
  );
  return revoke;
}

async function waitForRevokes(): Promise<void> {
  let pending = revokeChain;
  while (true) {
    await pending;
    if (revokeChain === pending) {
      return;
    }
    pending = revokeChain;
  }
}

function revokeSession(): Promise<void> {
  return http
    .request({
      method: 'POST',
      path: '/auth/token/revoke',
      body: { fingerprint: getOrCreateFingerprint() },
    })
    .then(() => undefined);
}

function assertCurrentAttempt(attempt: number): void {
  if (attempt !== loginAttempt) {
    throw new Error('Login attempt is obsolete.');
  }
}

function parseDeviceSessionToken(value: unknown): string {
  if (!isRecord(value) || typeof value.device_session_token !== 'string' || value.device_session_token === '') {
    throw new Error('Login response is missing a device session token.');
  }

  return value.device_session_token;
}

export function loginErrorMessage(error: unknown): string {
  if (error instanceof HttpError || error instanceof Error) {
    return error.message;
  }

  return 'Unable to sign in.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
