import type { FieldErrors } from '@/shared/api/errors';

export type LoginFormValues = {
  email: string;
  password: string;
};

export function validateLoginForm(values: LoginFormValues): FieldErrors | undefined {
  const errors: Record<string, string[]> = {};
  const email = values.email.trim();
  const password = values.password.trim();

  if (email === '') {
    errors.email = ['Email is required.'];
  } else if (!isReasonableEmail(email)) {
    errors.email = ['Enter a valid email address.'];
  }

  if (password === '') {
    errors.password = ['Password is required.'];
  }

  if (Object.keys(errors).length === 0) {
    return undefined;
  }

  return errors;
}

export function clearFieldError(fieldErrors: FieldErrors | undefined, field: string): FieldErrors | undefined {
  if (fieldErrors === undefined || fieldErrors[field] === undefined) {
    return fieldErrors;
  }

  const next: Record<string, readonly string[]> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (key !== field) {
      next[key] = messages;
    }
  }

  return Object.keys(next).length === 0 ? undefined : next;
}

function isReasonableEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
