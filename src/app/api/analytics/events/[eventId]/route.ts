import { NextResponse } from 'next/server';
// Analytics collection is not a source of verified viewer metrics yet.
export async function GET() {
  return NextResponse.json({ success: false, error: '視聴分析は未実装です' }, { status: 501 });
}
