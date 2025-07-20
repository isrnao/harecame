import { NextRequest, NextResponse } from 'next/server';
import type { ViewerInteraction } from '@/lib/analytics';

// POST /api/analytics/interactions - 視聴者インタラクションを記録
export async function POST(request: NextRequest) {
  try {
    const interaction: ViewerInteraction = await request.json();

    // 基本的なバリデーション
    if (!interaction.eventId || !interaction.action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 実際の実装では、データベースに保存
    // 現在はログ出力のみ（開発用）
    console.log('Analytics interaction recorded:', {
      eventId: interaction.eventId,
      action: interaction.action,
      timestamp: interaction.timestamp,
      metadata: interaction.metadata,
    });

    // React 19の after() API使用想定箇所
    // 実際の実装では、非ブロッキングでデータベースに保存
    // after(() => {
    //   saveToDatabase(interaction);
    // });

    return NextResponse.json({
      success: true,
      message: 'Interaction recorded successfully',
    });
  } catch (error) {
    console.error('Failed to record analytics interaction:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}