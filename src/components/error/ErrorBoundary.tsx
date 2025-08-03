"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { isErrorInfo } from '@/lib/type-guards';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // エラーが発生したときの状態更新
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // React 19.1.0の強化されたエラー情報を活用
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // カスタムエラーハンドラーを呼び出し
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // エラーログをサーバーに送信（非ブロッキング）
    this.logErrorToServer(error, errorInfo);
  }

  private async logErrorToServer(error: Error, errorInfo: ErrorInfo) {
    try {
      // React 19.1.0のOwner Stackを活用したエラー情報
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: isErrorInfo(errorInfo) ? errorInfo.errorBoundary?.constructor.name : undefined,
        errorBoundaryStack: isErrorInfo(errorInfo) ? errorInfo.errorBoundaryStack : undefined,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errorId: this.state.errorId,
      };

      await fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorReport),
      });
    } catch (logError) {
      console.error("Failed to log error to server:", logError);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  override render() {
    if (this.state.hasError) {
      // カスタムフォールバックUIが提供されている場合
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトのエラーUI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-900">
                エラーが発生しました
              </CardTitle>
              <CardDescription>
                申し訳ございません。予期しないエラーが発生しました。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* エラー詳細（開発環境のみ） */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <Alert>
                  <Bug className="h-4 w-4" />
                  <AlertDescription className="text-xs font-mono">
                    <details>
                      <summary className="cursor-pointer mb-2">
                        エラー詳細（開発用）
                      </summary>
                      <div className="whitespace-pre-wrap break-all">
                        {this.state.error.message}
                        {this.state.error.stack && (
                          <div className="mt-2 text-xs opacity-70">
                            {this.state.error.stack}
                          </div>
                        )}
                      </div>
                    </details>
                  </AlertDescription>
                </Alert>
              )}

              {/* エラーID（サポート用） */}
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-2">
                  エラーID: {this.state.errorId}
                </p>
                <p className="text-xs text-gray-500">
                  問題が続く場合は、このIDをサポートにお知らせください。
                </p>
              </div>

              {/* アクションボタン */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={this.handleRetry}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  再試行
                </Button>
                <Button
                  onClick={this.handleReload}
                  className="flex-1"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  ページ再読み込み
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  className="flex-1"
                  variant="outline"
                >
                  <Home className="h-4 w-4 mr-2" />
                  ホームに戻る
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
