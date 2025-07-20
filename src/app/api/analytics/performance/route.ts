import { NextRequest, NextResponse } from 'next/server';

export interface PerformanceData {
  name: string;
  value: number;
  id: string;
  timestamp: number;
  url: string;
  userAgent: string;
}

export async function POST(request: NextRequest) {
  try {
    const data: PerformanceData = await request.json();

    // バリデーション
    if (!data.name || typeof data.value !== 'number' || !data.timestamp) {
      return NextResponse.json(
        { error: 'Invalid performance data' },
        { status: 400 }
      );
    }

    // パフォーマンスデータをログに記録
    console.log('Performance metric received:', {
      metric: data.name,
      value: data.value,
      timestamp: new Date(data.timestamp).toISOString(),
      url: data.url,
    });

    // 重要なメトリクスの場合は警告を出力
    const criticalThresholds = {
      LCP: 4000, // 4秒以上は問題
      INP: 500,  // 500ms以上は問題 (INPはFIDより高い閾値)
      CLS: 0.25, // 0.25以上は問題
      FCP: 3000, // 3秒以上は問題
      TTFB: 1800, // 1.8秒以上は問題
    };

    const threshold = criticalThresholds[data.name as keyof typeof criticalThresholds];
    if (threshold && data.value > threshold) {
      console.warn(`Performance issue detected - ${data.name}: ${data.value} (threshold: ${threshold})`);
    }

    // 本番環境では、ここでデータベースやモニタリングサービスに送信
    // 例: Supabase、DataDog、New Relic等
    if (process.env.NODE_ENV === 'production') {
      // await savePerformanceMetric(data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing performance data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // パフォーマンス統計の取得（管理者用）
  try {
    // 本番環境では実際の統計データを返す
    const mockStats = {
      averageMetrics: {
        LCP: 2500,
        INP: 200, // INPの平均値
        CLS: 0.1,
        FCP: 1800,
        TTFB: 800,
      },
      sampleCount: 100,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(mockStats);
  } catch (error) {
    console.error('Error fetching performance stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}