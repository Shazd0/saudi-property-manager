import React, { Component } from 'react';
import { useLanguage } from '../i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI error boundary caught an error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
          <div className="text-lg font-bold text-slate-800">Something went wrong</div>
          <div className="text-sm text-slate-600 mt-2">{this.state.message}</div>
          <button
            onClick={this.handleReload}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
