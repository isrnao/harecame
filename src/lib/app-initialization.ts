// アプリケーション初期化ロジックの最適化
// モジュールレベルでの実行により、開発環境での二重実行問題を解決

// 環境変数の定数
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// 初期化状態を管理するフラグ
let isAppInitialized = false;
let isInitializing = false;

// 初期化完了を待つためのPromise
let initializationPromise: Promise<void> | null = null;

// アプリケーション初期化設定
interface AppInitializationConfig {
  enableAnalytics: boolean;
  enableErrorReporting: boolean;
  enablePerformanceMonitoring: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// デフォルト設定
const defaultConfig: AppInitializationConfig = {
  enableAnalytics: IS_PRODUCTION,
  enableErrorReporting: IS_PRODUCTION,
  enablePerformanceMonitoring: IS_PRODUCTION,
  logLevel: IS_DEVELOPMENT ? 'debug' : 'info',
};

// アプリケーション初期化関数
export async function initializeApp(config: Partial<AppInitializationConfig> = {}): Promise<void> {
  // 既に初期化済みの場合は何もしない
  if (isAppInitialized) {
    return;
  }

  // 初期化中の場合は完了を待つ
  if (isInitializing && initializationPromise) {
    return initializationPromise;
  }

  isInitializing = true;

  initializationPromise = (async () => {
    try {
      const finalConfig = { ...defaultConfig, ...config };

      console.log('Initializing Harecame application...', {
        environment: process.env.NODE_ENV,
        config: finalConfig,
      });

      // 1. パフォーマンス監視の初期化
      if (finalConfig.enablePerformanceMonitoring) {
        await initializePerformanceMonitoring();
      }

      // 2. エラーレポーティングの初期化
      if (finalConfig.enableErrorReporting) {
        await initializeErrorReporting();
      }

      // 3. アナリティクスの初期化
      if (finalConfig.enableAnalytics) {
        await initializeAnalytics();
      }

      // 4. グローバルエラーハンドラーの設定
      setupGlobalErrorHandlers();

      // 5. リソース監視の設定
      setupResourceMonitoring();

      isAppInitialized = true;
      console.log('Harecame application initialized successfully');

    } catch (error) {
      console.error('Failed to initialize application:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initializationPromise;
}

// パフォーマンス監視の初期化
async function initializePerformanceMonitoring(): Promise<void> {
  try {
    // Web Vitalsの監視を開始
    if (typeof window !== 'undefined') {
      const { onCLS, onINP, onFCP, onLCP, onTTFB } = await import('web-vitals');

      // Core Web Vitalsを監視
      onCLS(sendToAnalytics);
      onINP(sendToAnalytics);
      onFCP(sendToAnalytics);
      onLCP(sendToAnalytics);
      onTTFB(sendToAnalytics);

      console.log('Performance monitoring initialized');
    }
  } catch (error) {
    console.error('Failed to initialize performance monitoring:', error);
  }
}

// エラーレポーティングの初期化
async function initializeErrorReporting(): Promise<void> {
  try {
    // 本番環境では実際の監視サービス（Sentry等）を初期化
    if (IS_PRODUCTION) {
      // const Sentry = await import('@sentry/nextjs');
      // Sentry.init({
      //   dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      //   environment: process.env.NODE_ENV,
      // });
    }

    console.log('Error reporting initialized');
  } catch (error) {
    console.error('Failed to initialize error reporting:', error);
  }
}

// アナリティクスの初期化
async function initializeAnalytics(): Promise<void> {
  try {
    // Google Analytics等の初期化
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GA_ID) {
      // gtag初期化コード
      console.log('Analytics initialized');
    }
  } catch (error) {
    console.error('Failed to initialize analytics:', error);
  }
}

// グローバルエラーハンドラーの設定
function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  // 未処理のPromise拒否をキャッチ
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    // エラーレポーティングサービスに送信
    if (IS_PRODUCTION) {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: event.reason?.message || 'Unhandled promise rejection',
          stack: event.reason?.stack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorId: `unhandled-${Date.now()}`,
        }),
      }).catch(() => {
        // エラー送信の失敗は静かに処理
      });
    }
  });

  // 未処理のJavaScriptエラーをキャッチ
  window.addEventListener('error', (event) => {
    console.error('Unhandled JavaScript error:', event.error);

    // エラーレポーティングサービスに送信
    if (IS_PRODUCTION) {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: event.error?.message || event.message,
          stack: event.error?.stack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorId: `js-error-${Date.now()}`,
        }),
      }).catch(() => {
        // エラー送信の失敗は静かに処理
      });
    }
  });
}

// メモリ情報の型定義
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// Performance APIの拡張型定義
interface PerformanceWithMemory extends Performance {
  memory?: MemoryInfo;
}

// リソース監視の設定
function setupResourceMonitoring(): void {
  if (typeof window === 'undefined') return;

  // メモリ使用量の監視（対応ブラウザのみ）
  const performanceWithMemory = performance as PerformanceWithMemory;
  if (performanceWithMemory.memory) {
    const checkMemoryUsage = () => {
      const memory = performanceWithMemory.memory!;
      const memoryUsage = {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      };

      // メモリ使用量が80%を超えた場合は警告
      if (memoryUsage.used / memoryUsage.limit > 0.8) {
        console.warn('High memory usage detected:', memoryUsage);
      }
    };

    // 30秒ごとにメモリ使用量をチェック
    setInterval(checkMemoryUsage, 30000);
  }

  // ページの可視性変更を監視
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('Page became hidden');
      // バックグラウンドでのリソース使用を最適化
    } else {
      console.log('Page became visible');
      // フォアグラウンドでの処理を再開
    }
  });
}

// Web Vitalsメトリクスの型定義
interface WebVitalsMetric {
  name: string;
  value: number;
  id: string;
  delta?: number;
  entries?: PerformanceEntry[];
}

// パフォーマンスメトリクスをアナリティクスに送信
function sendToAnalytics(metric: WebVitalsMetric): void {
  // アナリティクスAPIに送信
  fetch('/api/analytics/performance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  }).catch(() => {
    // エラーは静かに処理
  });
}

// 初期化状態を取得
export function isApplicationInitialized(): boolean {
  return isAppInitialized;
}

// 初期化完了を待つ
export function waitForInitialization(): Promise<void> {
  if (isAppInitialized) {
    return Promise.resolve();
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  // 初期化が開始されていない場合は開始
  return initializeApp();
}

// 開発環境用のWindow拡張型定義
interface WindowWithDevTools extends Window {
  __resetAppInitialization?: () => void;
}

// 開発環境でのリセット（ホットリロード対応）
if (IS_DEVELOPMENT && typeof window !== 'undefined') {
  (window as WindowWithDevTools).__resetAppInitialization = () => {
    isAppInitialized = false;
    isInitializing = false;
    initializationPromise = null;
    console.log('App initialization state reset for development');
  };
}
