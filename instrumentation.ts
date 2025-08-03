// Next.js 15 instrumentation.ts
// 全サーバーエラーを統一的にキャッチし、監視サービスに送信

export async function register() {
  // アプリケーション起動時の初期化処理
  console.log('Instrumentation: Application starting...');

  // 本番環境では監視サービス（Sentry等）を初期化
  if (process.env.NODE_ENV === 'production') {
    await initializeMonitoring();
  }

  console.log('Instrumentation: Application initialized');
}

export async function onRequestError(
  err: Error,
  request: Request,
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'route' | 'page' | 'layout' | 'not-found' | 'loading' | 'error';
    renderSource: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
    revalidateReason?: 'on-demand' | 'stale-while-revalidate';
    pathname?: string;
  }
) {
  // 全サーバーエラーを統一的にキャッチ
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    name: err.name,
    digest: (err as any).digest, // Next.jsのエラーダイジェスト
    url: request?.url || 'unknown',
    method: request?.method || 'unknown',
    userAgent: request?.headers && typeof request.headers.get === 'function' 
      ? request.headers.get('user-agent') 
      : 'unknown',
    timestamp: new Date().toISOString(),
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
    pathname: context.pathname,
  };

  // コンソールにエラー情報を出力
  console.error('Server Error Caught by Instrumentation:', errorInfo);

  // 本番環境では監視サービスに送信
  if (process.env.NODE_ENV === 'production') {
    await sendErrorToMonitoring(errorInfo);
  }

  // 開発環境では詳細なデバッグ情報を出力
  if (process.env.NODE_ENV === 'development') {
    console.group('🔍 Error Debug Information');
    console.log('Error Type:', err.constructor.name);
    console.log('Route Context:', context);
    if (request?.headers && typeof request.headers.entries === 'function') {
      console.log('Request Headers:', Object.fromEntries(request.headers.entries()));
    } else {
      console.log('Request Headers: unavailable');
    }
    console.groupEnd();
  }
}

// 監視サービスの初期化
async function initializeMonitoring() {
  try {
    // Sentryの初期化例
    // const Sentry = await import('@sentry/nextjs');
    // Sentry.init({
    //   dsn: process.env.SENTRY_DSN,
    //   environment: process.env.NODE_ENV,
    //   tracesSampleRate: 0.1,
    //   beforeSend(event) {
    //     // 機密情報をフィルタリング
    //     return filterSensitiveData(event);
    //   },
    // });

    console.log('Monitoring service initialized');
  } catch (error) {
    console.error('Failed to initialize monitoring service:', error);
  }
}

// エラー情報を監視サービスに送信
async function sendErrorToMonitoring(errorInfo: any) {
  try {
    // Sentryへの送信例
    // const Sentry = await import('@sentry/nextjs');
    // Sentry.captureException(new Error(errorInfo.message), {
    //   tags: {
    //     routerKind: errorInfo.routerKind,
    //     routeType: errorInfo.routeType,
    //     renderSource: errorInfo.renderSource,
    //   },
    //   extra: {
    //     digest: errorInfo.digest,
    //     routePath: errorInfo.routePath,
    //     pathname: errorInfo.pathname,
    //     userAgent: errorInfo.userAgent,
    //   },
    //   fingerprint: [errorInfo.digest || errorInfo.message],
    // });

    // カスタム監視サービスへの送信例
    await fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorInfo),
    }).catch(err => {
      // エラー送信の失敗は静かに処理
      console.debug('Failed to send error to monitoring service:', err);
    });

    console.log('Error sent to monitoring service:', errorInfo.digest || errorInfo.message);
  } catch (error) {
    console.error('Failed to send error to monitoring service:', error);
  }
}

// 機密情報をフィルタリング
function filterSensitiveData(data: any): any {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];

  if (typeof data === 'object' && data !== null) {
    const filtered = { ...data };

    for (const key in filtered) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        filtered[key] = '[REDACTED]';
      } else if (typeof filtered[key] === 'object') {
        filtered[key] = filterSensitiveData(filtered[key]);
      }
    }

    return filtered;
  }

  return data;
}
