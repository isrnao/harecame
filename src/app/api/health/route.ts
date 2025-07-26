import { NextResponse } from 'next/server';

// Next.js 15: キャッシュ設定を明示化
export const dynamic = 'force-static';

// GET /api/health - ヘルスチェックエンドポイント
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

// HEAD /api/health - 軽量なヘルスチェック（接続テスト用）
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}