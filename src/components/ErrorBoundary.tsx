import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || '',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FDF8F5] text-[#43302B] p-6">
          <div className="max-w-md w-full rounded-3xl border-2 border-[#EAD8D0] bg-[#FFFBF9] p-8 text-center shadow-lg space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#F4B8C5]/35 flex items-center justify-center mx-auto text-2xl">
              🌸
            </div>
            <h1 className="font-serif-title text-2xl font-bold text-[#43302B]">
              Có chút trục trặc, bạn tải lại trang nhé
            </h1>
            <p className="text-xs text-[#856A62] leading-relaxed">
              Góc Nhỏ Lấp Lánh vừa gặp một gián đoạn nhỏ khi hiển thị. Bạn bấm nút bên dưới để làm mới lại trang nhé!
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-6 py-2.5 rounded-full text-xs font-bold bg-[#F4B8C5] text-[#3a2b30] hover:opacity-95 transition-all cursor-pointer shadow-xs"
              >
                🔄 Tải lại
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
