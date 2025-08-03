"use client";

import { useEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";

type Props = {
  children: ReactNode;
  fallback?: ReactNode; // クライアント要素推奨
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

export default function ErrorBoundaryClient({ children, fallback, onError }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {/* SSR時は空。CSRマウント後にのみ子を描画して、RSCからのイベントハンドラシリアライズを防止 */}
      <div suppressHydrationWarning>
        {mounted ? children : null}
      </div>
    </ErrorBoundary>
  );
}
