import { useState, type ChangeEvent, type FormEvent } from 'react';
import { HttpError, type FieldErrors } from '@/shared/api/errors';
import { login, loginErrorMessage } from '@/features/auth/api/authApi';
import { clearFieldError, validateLoginForm } from './utils/loginValidation';

export function useLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>();

  async function signIn(): Promise<void> {
    if (pending) {
      return;
    }

    const clientErrors = validateLoginForm({ email, password });
    if (clientErrors !== undefined) {
      setFormError(undefined);
      setFieldErrors(clientErrors);
      return;
    }

    setPending(true);
    setFormError(undefined);
    setFieldErrors(undefined);

    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      setFormError(loginErrorMessage(error));
      setFieldErrors(error instanceof HttpError ? error.fieldErrors : undefined);
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void signIn();
  }

  function onEmailChange(event: ChangeEvent<HTMLInputElement>): void {
    setEmail(event.target.value);
    setFieldErrors((current) => clearFieldError(current, 'email'));
  }

  function onPasswordChange(event: ChangeEvent<HTMLInputElement>): void {
    setPassword(event.target.value);
    setFieldErrors((current) => clearFieldError(current, 'password'));
  }

  function toggleShowPassword(): void {
    setShowPassword((current) => !current);
  }

  return {
    email,
    password,
    showPassword,
    pending,
    formError,
    emailError: fieldMessage(fieldErrors, 'email'),
    passwordError: fieldMessage(fieldErrors, 'password'),
    onSubmit,
    onEmailChange,
    onPasswordChange,
    toggleShowPassword,
  };
}

function fieldMessage(fieldErrors: FieldErrors | undefined, field: string): string | undefined {
  const messages = fieldErrors?.[field];
  if (messages === undefined || messages.length === 0) {
    return undefined;
  }

  return messages.join(' ');
}
