export const SESSION_TTL_MS = 30_000;
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'WebhookApp-Demo-2026!';
const DEMO_FIRST_NAME = 'Demo';
const DEMO_LAST_NAME = 'User';
const DEMO_NAME = 'Demo User';
const DEMO_USER_ID = 'user-1';

export const mockDeviceSessionToken = 'mock-token';

export type MockFieldErrors = Record<string, string[]>;

export type MockFailure = {
  ok: false;
  status: number;
  type: string;
  message: string;
  fieldErrors?: MockFieldErrors;
};

export type MockSuccess<T> = {
  ok: true;
  value: T;
};

export type MockResult<T> = MockSuccess<T> | MockFailure;

type PendingLogin = {
  token: string;
  email: string;
  fingerprint: string;
};

type IssuedSession = {
  version: number;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  fingerprint: string;
  expiresAt: number;
};

let readNow: () => number = () => Date.now();
let version = 0;
let pending: PendingLogin | null = null;
let issued: IssuedSession | null = null;
let rotateCount = 0;
let issueCount = 0;
let rotationPause: Promise<void> | null = null;
let notifyRotationEntered: (() => void) | null = null;
let revokePause: Promise<void> | null = null;
let notifyRevokeEntered: (() => void) | null = null;
const issueGates: Array<{ pause: Promise<void>; onEntered: () => void }> = [];

export function resetMockAuth(): void {
  readNow = () => Date.now();
  version = 0;
  pending = null;
  issued = null;
  rotateCount = 0;
  issueCount = 0;
  rotationPause = null;
  notifyRotationEntered = null;
  revokePause = null;
  notifyRevokeEntered = null;
  issueGates.length = 0;
}

export function setMockAuthNow(next: () => number): void {
  readNow = next;
}

export function pauseNextRotation(pause: Promise<void>, onEntered: () => void): void {
  rotationPause = pause;
  notifyRotationEntered = onEntered;
}

export function getMockRotateCount(): number {
  return rotateCount;
}

export function getMockIssueCount(): number {
  return issueCount;
}

export function pauseNextRevoke(pause: Promise<void>, onEntered: () => void): void {
  revokePause = pause;
  notifyRevokeEntered = onEntered;
}

export function pauseNextIssue(pause: Promise<void>, onEntered: () => void): void {
  issueGates.push({ pause, onEntered });
}

export function acceptLogin(input: {
  email: string | undefined;
  password: string | undefined;
  fingerprint: string | undefined;
  captcha: string | null;
}): MockResult<{ device_session_token: string }> {
  const fieldErrors: MockFieldErrors = {};

  if (input.captcha === null || input.captcha.trim() === '') {
    fieldErrors.captcha = ['A captcha token is required.'];
  }

  if (input.email === undefined || input.email.trim() === '') {
    fieldErrors.email = ['The email field is required.'];
  } else if (!input.email.includes('@')) {
    fieldErrors.email = ['The email must be a valid email address.'];
  }

  if (input.password === undefined || input.password === '') {
    fieldErrors.password = ['The password field is required.'];
  }

  if (input.fingerprint === undefined || !isFingerprint(input.fingerprint)) {
    fieldErrors.fingerprint = ['The fingerprint format is invalid.'];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return validation(fieldErrors);
  }

  if (
    input.email === undefined ||
    input.password === undefined ||
    input.fingerprint === undefined ||
    input.email !== DEMO_EMAIL ||
    input.password !== DEMO_PASSWORD
  ) {
    return validation({
      email: ['These credentials do not match our records.'],
    });
  }

  pending = {
    token: mockDeviceSessionToken,
    email: input.email,
    fingerprint: input.fingerprint,
  };

  return { ok: true, value: { device_session_token: mockDeviceSessionToken } };
}

export async function issueSession(input: {
  deviceSessionToken: string | undefined;
  fingerprint: string | undefined;
}): Promise<MockResult<null>> {
  const gate = issueGates.shift();
  if (gate !== undefined) {
    gate.onEntered();
    await gate.pause;
  }

  if (pending === null || input.deviceSessionToken !== pending.token || input.fingerprint !== pending.fingerprint) {
    return {
      ok: false,
      status: 400,
      type: 'BadRequestException',
      message: 'Device session cannot be issued.',
    };
  }

  issueCount += 1;
  version += 1;
  issued = {
    version,
    email: pending.email,
    first_name: DEMO_FIRST_NAME,
    last_name: DEMO_LAST_NAME,
    name: DEMO_NAME,
    fingerprint: pending.fingerprint,
    expiresAt: readNow() + SESSION_TTL_MS,
  };

  return { ok: true, value: null };
}

export async function rotateSession(fingerprint: string | undefined): Promise<MockResult<null>> {
  rotateCount += 1;

  if (issued === null || fingerprint !== issued.fingerprint) {
    return {
      ok: false,
      status: 400,
      type: 'BadRequestException',
      message: 'No active session can be rotated.',
    };
  }

  const versionAtStart = issued.version;
  const pause = rotationPause;
  const notify = notifyRotationEntered;
  rotationPause = null;
  notifyRotationEntered = null;
  notify?.();

  if (pause !== null) {
    await pause;
  }

  // Revoke bumps the version. A rotate that was already in flight must not recreate that session.
  if (issued === null || issued.version !== versionAtStart) {
    return {
      ok: false,
      status: 400,
      type: 'BadRequestException',
      message: 'No active session can be rotated.',
    };
  }

  issued = {
    ...issued,
    expiresAt: readNow() + SESSION_TTL_MS,
  };

  return { ok: true, value: null };
}

export async function revokeSession(fingerprint: string | undefined): Promise<void> {
  const pause = revokePause;
  const notify = notifyRevokeEntered;
  revokePause = null;
  notifyRevokeEntered = null;
  notify?.();

  if (pause !== null) {
    await pause;
  }

  if (issued !== null && fingerprint === issued.fingerprint) {
    version += 1;
    issued = null;
  }

  pending = null;
}

export function readCurrentUser(): MockResult<{
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
}> {
  if (issued === null || readNow() >= issued.expiresAt) {
    return {
      ok: false,
      status: 401,
      type: 'AuthenticationException',
      message: 'Unauthenticated.',
    };
  }

  return {
    ok: true,
    value: {
      id: DEMO_USER_ID,
      email: issued.email,
      first_name: issued.first_name,
      last_name: issued.last_name,
      name: issued.name,
    },
  };
}

function validation(fieldErrors: MockFieldErrors): MockFailure {
  return {
    ok: false,
    status: 422,
    type: 'ValidationException',
    message: 'The given data was invalid.',
    fieldErrors,
  };
}

function isFingerprint(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value);
}
