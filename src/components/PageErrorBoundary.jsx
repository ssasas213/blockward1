import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PageErrorBoundary — wraps the main content pane in src/Layout.jsx.
 *
 * WITHOUT it, an uncaught render error in any page widget unmounts the
 * ENTIRE React tree: the sidebar flashes in, then the whole app tears down
 * to a blank screen — the classic "shell loads, every section blank" failure.
 * WITH it, a crashing section shows a visible, retryable error card and the
 * shell keeps working. The boundary is keyed by page name in the Layout, so
 * navigating to another section always starts with a clean slate.
 */
export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surfaces in the browser console so the failure is diagnosable.
    console.error('Page render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5 rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">This section couldn't load</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Something went wrong while rendering this page. Try again — if it keeps
              happening, reload the app.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Try again
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Reload app
            </Button>
          </div>
        </div>
      </div>
    );
  }
}