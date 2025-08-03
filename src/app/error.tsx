"use client";

import React from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="text-red-600 text-xl font-semibold">エラーが発生しました</div>
        <p className="text-sm text-muted-foreground">申し訳ありません。ページの表示中に問題が発生しました。</p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-left whitespace-pre-wrap text-xs bg-muted/30 p-3 rounded-md overflow-auto">
            {`${error.message}\n${error.stack ?? ''}`}
          </pre>
        )}
        <div className="flex justify-center gap-2">
          <button type="button" onClick={() => reset()} className="px-4 py-2 rounded-md border">再試行</button>
          <a href="/" className="px-4 py-2 rounded-md border">ホームに戻る</a>
        </div>
        {error.digest && (
          <p className="text-xs text-muted-foreground">エラーID: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
