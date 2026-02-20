import React from 'react';
import { createPageUrl } from '@/utils';

export default class AIErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[BlockWard AI] Error caught by boundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto mt-20 p-8 bg-white rounded-2xl border border-red-200 shadow-lg text-center">
          <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">AI Assistant failed to load</h2>
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-6 text-left font-mono break-all">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              Reload
            </button>
            <a
              href={createPageUrl('Home')}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}