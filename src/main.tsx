import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[AppErrorBoundary] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] text-[#3D312A] p-6">
          <div className="max-w-md w-full rounded-3xl bg-white/90 border border-[#E8DEC8] shadow-xl p-8 text-center space-y-4">
            <div className="text-4xl">🌿</div>
            <h1 className="text-xl font-bold text-[#3D312A]">
              Có chút trục trặc, bạn tải lại trang nhé
            </h1>
            <p className="text-sm text-[#7A6A5E]">
              Góc nhỏ vừa vấp nhẹ một chút. Bạn bấm nút bên dưới để làm mới lại trang nha!
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-full bg-[#C97A63] hover:bg-[#B56750] text-white text-sm font-medium transition shadow-sm cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);

