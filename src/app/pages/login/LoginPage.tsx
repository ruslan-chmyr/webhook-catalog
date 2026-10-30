import { Box, Button, Field, Flex, Heading, Input, InputGroup, Stack, Text } from '@chakra-ui/react';
import { Navigate, useLocation } from 'react-router';
import { BrandMark } from '@/app/components/BrandMark';
import { useLoginForm } from './useLoginForm';
import { readPostLoginPath } from './utils/loginRedirect';
import { useAuthActive } from '@/features/auth/hooks/useAuthActive';

export function LoginPage() {
  const active = useAuthActive();
  const location = useLocation();
  const nextPath = readPostLoginPath(location.state);
  const {
    email,
    password,
    showPassword,
    pending,
    formError,
    emailError,
    passwordError,
    onSubmit,
    onEmailChange,
    onPasswordChange,
    toggleShowPassword,
  } = useLoginForm();

  const hasEmailError = emailError !== undefined;
  const hasPasswordError = passwordError !== undefined;
  const hasFormError = formError !== undefined;

  if (active) {
    return <Navigate to={nextPath} replace />;
  }

  return (
    <Flex minH="100vh" align="center" justify="center">
      <Box
        as="form"
        aria-label="Sign in"
        w="full"
        maxW="sm"
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        rounded="xl"
        shadow="sm"
        px="8"
        py="8"
        {...({ noValidate: true, onSubmit } as object)}
      >
        <Stack gap="4">
          <Stack align="center" gap="2" textAlign="center">
            <BrandMark size={40} />
            <Heading as="h1" size="lg">
              WebhookApp
            </Heading>
            <Text color="gray.600" fontSize="sm">
              Sign in to manage your webhooks
            </Text>
          </Stack>
          <Field.Root invalid={hasEmailError}>
            <Field.Label htmlFor="email">Email</Field.Label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              disabled={pending}
              aria-invalid={hasEmailError ? true : undefined}
              aria-describedby={hasEmailError ? 'email-error' : undefined}
              onChange={onEmailChange}
            />
            {hasEmailError ? <Field.ErrorText id="email-error">{emailError}</Field.ErrorText> : null}
          </Field.Root>
          <Field.Root invalid={hasPasswordError}>
            <Field.Label htmlFor="password">Password</Field.Label>
            <InputGroup
              w="full"
              endElement={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={pending}
                  onClick={toggleShowPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              }
            >
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                disabled={pending}
                aria-invalid={hasPasswordError ? true : undefined}
                aria-describedby={hasPasswordError ? 'password-error' : undefined}
                onChange={onPasswordChange}
              />
            </InputGroup>
            {hasPasswordError ? <Field.ErrorText id="password-error">{passwordError}</Field.ErrorText> : null}
          </Field.Root>
          {hasFormError ? (
            <Text role="alert" color="red.700" fontSize="sm">
              {formError}
            </Text>
          ) : null}
          <Button type="submit" colorPalette="blue" w="full" loading={pending} disabled={pending} aria-label="Sign in">
            Sign in
          </Button>
          <Box textAlign="center" fontSize="sm" color="gray.600">
            <Text fontWeight="medium">Demo credentials</Text>
            <Text>Email: demo@example.com</Text>
            <Text>Password: WebhookApp-Demo-2026!</Text>
          </Box>
        </Stack>
      </Box>
    </Flex>
  );
}
