let deviceSessionToken: string | null = null;

export function rememberDeviceSessionToken(token: string): void {
  deviceSessionToken = token;
}

export function clearDeviceSessionToken(): void {
  deviceSessionToken = null;
}

export function getDeviceSessionToken(): string | null {
  return deviceSessionToken;
}
