import { NextRequest, NextResponse } from 'next/server';

interface ClientErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  errorId: string;
}

interface ServerErrorReport {
  message: string;
  stack?: string;
  name: string;
  digest?: string;
  url: string;
  method: string;
  userAgent?: string;
  timestamp: string;
  routerKind: 'Pages Router' | 'App Router';
  routePath: string;
  routeType: 'route' | 'page' | 'layout' | 'not-found' | 'loading' | 'error';
  renderSource: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
  revalidateReason?: 'on-demand' | 'stale-while-revalidate';
  pathname?: string;
}

type ErrorReport = ClientErrorReport | ServerErrorReport;

// POST /api/errors - エラーレポートを受信
export async function POST(request: NextRequest) {
  try {
    const errorReport: ErrorReport = await request.json();

    // エラータイプを判定
    const isServerError = 'routerKind' in errorReport;
    const isClientError = 'errorId' in errorReport;

    // 基本的なバリデーション
    if (!errorReport.message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (isServerError) {
      // サーバーエラーの処理
      const serverError = errorReport as ServerErrorReport;
      console.error('Server Error Report (from instrumentation.ts):', {
        message: serverError.message,
        digest: serverError.digest,
        routePath: serverError.routePath,
        routeType: serverError.routeType,
        timestamp: serverError.timestamp,
        url: serverError.url,
        method: serverError.method,
        routerKind: serverError.routerKind,
        renderSource: serverError.renderSource,
      });

      await saveServerErrorReport(serverError);
    } else if (isClientError) {
      // クライアントエラーの処理
      const clientError = errorReport as ClientErrorReport;
      console.error('Client Error Report:', {
        errorId: clientError.errorId,
        message: clientError.message,
        timestamp: clientError.timestamp,
        url: clientError.url,
        userAgent: clientError.userAgent,
        stack: clientError.stack,
        componentStack: clientError.componentStack,
      });

      await saveClientErrorReport(clientError);
    }

    // 重要なエラーの場合は即座に通知
    if (isCritical(errorReport)) {
      await notifyDevelopers(errorReport);
    }

    return NextResponse.json({
      success: true,
      message: 'Error report received',
      errorId: isClientError ? (errorReport as ClientErrorReport).errorId : (errorReport as ServerErrorReport).digest,
    });
  } catch (error) {
    console.error('Failed to process error report:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// サーバーエラーレポートを保存
async function saveServerErrorReport(errorReport: ServerErrorReport) {
  console.log('Saving server error report to database:', {
    digest: errorReport.digest,
    routePath: errorReport.routePath,
    message: errorReport.message,
  });

  // 実際の実装では、データベースに保存
  // await database.serverErrors.create(errorReport);
}

// クライアントエラーレポートを保存
async function saveClientErrorReport(errorReport: ClientErrorReport) {
  console.log('Saving client error report to database:', {
    errorId: errorReport.errorId,
    message: errorReport.message,
    url: errorReport.url,
  });

  // 実際の実装では、データベースに保存
  // await database.clientErrors.create(errorReport);
}

// 重要なエラーかどうかを判定
function isCritical(errorReport: ErrorReport): boolean {
  const criticalKeywords = [
    'ChunkLoadError',
    'NetworkError',
    'SecurityError',
    'LiveKit',
    'Camera',
    'Microphone',
    'TypeError',
    'ReferenceError',
    'SyntaxError',
  ];

  return criticalKeywords.some(keyword =>
    errorReport.message.includes(keyword) ||
    (errorReport.stack && errorReport.stack.includes(keyword))
  );
}

// 開発者への通知（実際の実装では外部サービスを使用）
async function notifyDevelopers(errorReport: ErrorReport) {
  const isServerError = 'routerKind' in errorReport;
  const isClientError = 'errorId' in errorReport;

  if (isServerError) {
    const serverError = errorReport as ServerErrorReport;
    console.warn('CRITICAL SERVER ERROR DETECTED:', {
      digest: serverError.digest,
      message: serverError.message,
      routePath: serverError.routePath,
      url: serverError.url,
      timestamp: serverError.timestamp,
    });
  } else if (isClientError) {
    const clientError = errorReport as ClientErrorReport;
    console.warn('CRITICAL CLIENT ERROR DETECTED:', {
      errorId: clientError.errorId,
      message: clientError.message,
      url: clientError.url,
      timestamp: clientError.timestamp,
    });
  }

  // 実際の実装では、Slack、Discord、メール等で通知
  // await sendSlackNotification(errorReport);
  // await sendEmailAlert(errorReport);
}
