/** Queries under this prefix hold session data and are removed when authentication ends. */
export const privateQueryKey = ['private'] as const;

export const currentUserQueryKey = ['private', 'me'] as const;

export type CurrentUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
};

export function parseCurrentUser(value: unknown): CurrentUser {
  if (!isRecord(value)) {
    throw new Error('Current user response is invalid.');
  }

  const { id, email, first_name: firstName, last_name: lastName, name } = value;
  if (
    typeof id !== 'string' ||
    typeof email !== 'string' ||
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    typeof name !== 'string'
  ) {
    throw new Error('Current user response is invalid.');
  }

  return {
    id,
    email,
    first_name: firstName,
    last_name: lastName,
    name,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
