import { describe, expect, it } from 'vitest';
import { clearFieldError, validateLoginForm } from './loginValidation';

describe('validateLoginForm', () => {
  it('requires email and password', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: ['Email is required.'],
      password: ['Password is required.'],
    });
    expect(validateLoginForm({ email: '   ', password: '\t' })).toEqual({
      email: ['Email is required.'],
      password: ['Password is required.'],
    });
  });

  it('rejects an unreasonable email format', () => {
    expect(
      validateLoginForm({
        email: 'not-an-email',
        password: 'WebhookApp-Demo-2026!',
      }),
    ).toEqual({
      email: ['Enter a valid email address.'],
    });
  });

  it('accepts a complete form', () => {
    expect(
      validateLoginForm({
        email: 'demo@example.com',
        password: 'WebhookApp-Demo-2026!',
      }),
    ).toBeUndefined();
  });
});

describe('clearFieldError', () => {
  it('removes only the edited field', () => {
    expect(
      clearFieldError(
        {
          email: ['Email is required.'],
          password: ['Password is required.'],
        },
        'email',
      ),
    ).toEqual({
      password: ['Password is required.'],
    });
  });
});
