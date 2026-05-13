import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Catches rendering errors from any child screen and shows a recovery UI
 * instead of crashing the full app. Logged to console for debugging.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Kipita] Screen error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm font-bold text-foreground">Something went wrong loading this screen.</p>
          <p className="text-xs text-muted-foreground">{this.state.errorMessage}</p>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            className="px-5 py-2 rounded-kipita bg-kipita-red text-white text-sm font-bold"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
