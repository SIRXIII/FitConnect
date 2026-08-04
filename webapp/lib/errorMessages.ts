export interface AppError {
  title: string;
  message: string;
  recoverable: boolean;
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
