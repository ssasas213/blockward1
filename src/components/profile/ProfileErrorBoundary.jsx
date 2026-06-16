import React from 'react';

export default class ProfileErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Profile] Render error:', error?.message || error, errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto mt-16 text-center p-8 bg-red-50 border border-red-200 rounded-2xl">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-semibold text-red-700 mb-2">Something went wrong</p>
          <p className="text-sm text-red-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred while rendering the Profile page.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}