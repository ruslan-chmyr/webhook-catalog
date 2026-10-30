export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export class HttpError extends Error {
  readonly status: number;
  readonly errorType: string | undefined;
  readonly fieldErrors: FieldErrors | undefined;
  readonly payload: unknown;

  constructor(
    status: number,
    message: string,
    details: {
      errorType?: string;
      fieldErrors?: FieldErrors;
      payload?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.errorType = details.errorType;
    this.fieldErrors = details.fieldErrors;
    this.payload = details.payload;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readFieldErrors(value: unknown): FieldErrors | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const fieldErrors: Record<string, readonly string[]> = {};

  for (const [field, messages] of Object.entries(value)) {
    if (!isStringArray(messages)) {
      return undefined;
    }

    fieldErrors[field] = messages;
  }

  return fieldErrors;
}

function readBackendError(value: unknown):
  | {
      errorType: string | undefined;
      message: string | undefined;
      fieldErrors: FieldErrors | undefined;
      payload: unknown;
    }
  | undefined {
  if (!isRecord(value) || !isRecord(value.error)) {
    return undefined;
  }

  const error = value.error;

  return {
    errorType: typeof error.type === 'string' ? error.type : undefined,
    message: typeof error.message === 'string' ? error.message : undefined,
    fieldErrors: readFieldErrors(error.payload),
    payload: 'payload' in error ? error.payload : undefined,
  };
}

export async function httpErrorFromResponse(response: Response): Promise<HttpError> {
  const text = await response.text();
  let backend: ReturnType<typeof readBackendError>;

  if (text.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(text);
      backend = readBackendError(parsed);
    } catch {
      backend = undefined;
    }
  }

  return new HttpError(response.status, backend?.message ?? `HTTP ${response.status}`, {
    errorType: backend?.errorType,
    fieldErrors: backend?.fieldErrors,
    payload: backend?.payload,
  });
}
