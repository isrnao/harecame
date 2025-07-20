import { NextRequest, NextResponse } from 'next/server';
import type { ViewerAnalytics } from '@/lib/analytics';

// GET /api/analytics/events/[eventId] - イベントの分析データを取得
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;

    // 実際の実装では、データベースから分析データを集計
    // 現在はモックデータを返す（開発用）
    const mockAnalytics: ViewerAnalytics = {
      eventId,
      totalViewers: Math.floor(Math.random() * 100) + 10,
      peakViewers: Math.floor(Math.random() * 50) + 20,
      averageViewDuration: Math.floor(Math.random() * 1800) + 300, // 5-35分
      chatEngagement: Math.floor(Math.random() * 80) + 10, // 10-90%
      qualityDistribution: {
        '720p': 60,
        '480p': 25,
        '360p': 15,
      },
      deviceTypes: {
        mobile: 45,
        desktop: 35,
        tablet: 20,
      },
    };

    return NextResponse.json(mockAnalytics);
  } catch (error) {
    console.error('Failed to get event analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get analytics data' },
      { status: 500 }
    );
  }
}