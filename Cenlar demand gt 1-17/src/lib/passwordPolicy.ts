export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS =
  `Use at least ${PASSWORD_MIN_LENGTH} characters. A long, unique passphrase is strongest.`;

export type PasswordValidationField = 'password' | 'confirmation';

export interface PasswordValidationError {
  field: PasswordValidationField;
  message: string;
}

export function getPasswordValidationError(
  password: string,
  confirmation: string,
): PasswordValidationError | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      field: 'password',
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  if (password !== confirmation) {
    return {
      field: 'confirmation',
      message: 'Passwords do not match.',
    };
  }

  return null;
}
