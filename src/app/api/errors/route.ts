import { NextRequest, NextResponse } from 'next/server';

interface ErrorReport {
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

// POST /api/errors - エラーレポートを受信
export async function POST(request: NextRequest) {
  try {
    const errorReport: ErrorReport = await request.json();

    // 基本的なバリデーション
    if (!errorReport.message || !errorReport.errorId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // エラーレポートをログに記録
    console.error('Client Error Report:', {
      errorId: errorReport.errorId,
      message: errorReport.message,
      timestamp: errorReport.timestamp,
      url: errorReport.url,
      userAgent: errorReport.userAgent,
      stack: errorReport.stack,
      componentStack: errorReport.componentStack,
    });

    // 実際の実装では、エラーレポートをデータベースや
    // 外部ログサービス（Sentry、LogRocket等）に送信
    // await saveErrorReport(errorReport);

    // 重要なエラーの場合は即座に通知
    if (isCritical(errorReport)) {
      await notifyDevelopers(errorReport);
    }

    return NextResponse.json({
      success: true,
      message: 'Error report received',
      errorId: errorReport.errorId,
    });
  } catch (error) {
    console.error('Failed to process error report:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
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
  ];

  return criticalKeywords.some(keyword => 
    errorReport.message.includes(keyword) || 
    (errorReport.stack && errorReport.stack.includes(keyword))
  );
}

// 開発者への通知（実際の実装では外部サービスを使用）
async function notifyDevelopers(errorReport: ErrorReport) {
  // 実際の実装では、Slack、Discord、メール等で通知
  console.warn('CRITICAL ERROR DETECTED:', {
    errorId: errorReport.errorId,
    message: errorReport.message,
    url: errorReport.url,
    timestamp: errorReport.timestamp,
  });
}