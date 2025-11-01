import React, { Component, ReactNode } from 'react';
import { AlertCircle, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full card">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  Something went wrong
                </h2>
                <p className="text-gray-600">
                  We encountered an unexpected error. Please try again.
                </p>
              </div>

              {this.state.error && (
                <details className="w-full text-left mt-4">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                    Error Details
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-40">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
                <button
                  onClick={this.handleReset}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

