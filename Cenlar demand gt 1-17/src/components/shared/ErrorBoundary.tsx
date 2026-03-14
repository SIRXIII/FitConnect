import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-paper px-6">
          <div className="max-w-md text-center space-y-6">
            <h1 className="text-3xl serif font-light italic text-ink">Something went wrong</h1>
            <p className="text-sm text-ink/50">
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            {this.state.error && (
              <p className="text-xs text-ink/30 font-mono bg-ink/5 p-4 text-left overflow-auto max-h-32">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="border border-ink/20 px-10 py-3 text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-ink hover:text-white transition-all duration-300"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
