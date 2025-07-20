import { useState, useRef, useCallback } from 'react';

/**
 * 統一されたローディング状態管理フック
 * isLoadingとisLoadingRefの同期問題を解決し、重複実行を防止する
 */
export function useLoadingState(initialLoading = false) {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const isLoadingRef = useRef(initialLoading);

  // ローディング状態を開始する
  const startLoading = useCallback(() => {
    console.log('Loading started');
    isLoadingRef.current = true;
    setIsLoading(true);
  }, []);

  // ローディング状態を終了する
  const stopLoading = useCallback(() => {
    console.log('Loading stopped');
    isLoadingRef.current = false;
    setIsLoading(false);
  }, []);

  // 現在のローディング状態を取得する
  const getCurrentLoadingState = useCallback(() => {
    return isLoadingRef.current;
  }, []);

  // 重複実行を防ぐラッパー関数
  const withLoadingProtection = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | null> => {
      if (isLoadingRef.current) {
        console.log('Operation skipped - already loading');
        return null;
      }

      startLoading();
      try {
        const result = await fn();
        return result;
      } catch (error) {
        console.error('Operation failed:', error);
        throw error;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  return {
    isLoading,
    startLoading,
    stopLoading,
    getCurrentLoadingState,
    withLoadingProtection,
  };
}
