import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logError } from '../lib/errors';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Never surface raw error/stack details to the user — log internally
    // only. In a later phase this can also POST to the server audit log.
    logError(error, { componentStack: info.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-50 px-6 text-center">
          <h1 className="text-lg font-semibold text-brand-900">Something went wrong</h1>
          <p className="max-w-sm text-sm text-brand-500">
            An unexpected error occurred. You can try returning to the homepage. If this keeps
            happening, please contact support.
          </p>
          <Button onClick={this.handleReset}>Go to homepage</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
