'use client';

import { useEffect } from 'react';
import { initializeApp, waitForInitialization } from '@/lib/app-initialization';

// アプリケーション初期化コンポーネント
export function AppInitializer() {
  useEffect(() => {
    // アプリケーション初期化を実行
    const initialize = async () => {
      try {
        await initializeApp({
          enableAnalytics: process.env.NODE_ENV === 'production',
          enableErrorReporting: true,
          enablePerformanceMonitoring: true,
          logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
        });
      } catch (error) {
        console.error('Failed to initialize application:', error);
      }
    };

    initialize();
  }, []);

  // このコンポーネントは何もレンダリングしない
  return null;
}

// 初期化完了を待つフック
export function useAppInitialization() {
  useEffect(() => {
    waitForInitialization().catch(error => {
      console.error('App initialization failed:', error);
    });
  }, []);
}
