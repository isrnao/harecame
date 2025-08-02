import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import type { ViewerInteraction } from '@/lib/analytics';

// データベースにインタラクションを保存する関数
async function saveInteractionToDatabase(interaction: ViewerInteraction) {
  // 実際の実装では、Supabaseやその他のデータベースに保存
  // 現在は開発用のログ出力
  console.log('Saving interaction to database:', {
    eventId: interaction.eventId,
    action: interaction.action,
    timestamp: interaction.timestamp,
    metadata: interaction.metadata,
  });

  // シミュレートされたデータベース保存処理
  await new Promise(resolve => setTimeout(resolve, 100));
}

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

    // after() APIを使用して応答後にデータベース保存を実行
    after(async () => {
      try {
        await saveInteractionToDatabase(interaction);
        console.log('Analytics interaction saved to database:', interaction.eventId);
      } catch (error) {
        console.error('Failed to save interaction to database:', error);
      }
    });

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
