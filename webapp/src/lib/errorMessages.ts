export interface AppError {
  title: string;
  message: string;
  recoverable: boolean;
}

/**
 * supabase.functions.invoke() rejects with a FunctionsHttpError whose .message is
 * always the generic "Edge Function returned a non-2xx status code". The real
 * `{ error: "..." }` body our functions return lives on .context (a Response),
 * so surface that instead of the generic string.
 */
export async function edgeFunctionError(error: unknown, fallback: string): Promise<string> {
  const response = (error as { context?: Response }).context;
  try {
    const body = await response?.clone().json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // body was empty or not JSON, fall through
  }
  if (error instanceof Error && !error.message.includes('non-2xx')) return error.message;
  return fallback;
}

export function mapError(error: unknown): AppError {
  if (error instanceof Error) {
    if (error.message.includes('JWT')) {
      return {
        title: 'Session expired',
        message: 'Your session has expired. Please sign in again to continue.',
        recoverable: false,
      };
    }
    if (error.message.includes('row-level security')) {
      return {
        title: 'Access denied',
        message: 'You do not have permission to perform this action.',
        recoverable: false,
      };
    }
    if (error.message.includes('duplicate key')) {
      return {
        title: 'Already exists',
        message: 'This item already exists. Please check and try again.',
        recoverable: false,
      };
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return {
        title: 'Connection problem',
        message: 'Could not reach the server. Check your internet connection and try again.',
        recoverable: true,
      };
    }
  }

  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    recoverable: true,
  };
}
