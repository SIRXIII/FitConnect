export type E2ERole = 'admin' | 'trainer' | 'client';

export interface E2EAccount {
  email: string;
  password: string;
}

const ROLE_VARIABLES: Record<E2ERole, { email: string; password: string }> = {
  admin: {
    email: 'FITRUSH_E2E_ADMIN_EMAIL',
    password: 'FITRUSH_E2E_ADMIN_PASSWORD',
  },
  trainer: {
    email: 'FITRUSH_E2E_TRAINER_EMAIL',
    password: 'FITRUSH_E2E_TRAINER_PASSWORD',
  },
  client: {
    email: 'FITRUSH_E2E_CLIENT_EMAIL',
    password: 'FITRUSH_E2E_CLIENT_PASSWORD',
  },
};

export function requireE2EAccount(role: E2ERole): E2EAccount {
  const variables = ROLE_VARIABLES[role];
  const email = process.env[variables.email];
  const password = process.env[variables.password];
  const missing = [
    !email?.trim() ? variables.email : null,
    !password ? variables.password : null,
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0) {
    throw new Error(
      `Missing required FitRush E2E credentials for the ${role} role: ${missing.join(', ')}. ` +
      'Copy .env.e2e.example to .env.e2e and set disposable test-account values.',
    );
  }

  return { email: email.trim(), password };
}
