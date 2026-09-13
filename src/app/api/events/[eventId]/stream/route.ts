import { NextResponse } from 'next/server';
// The previous endpoint emitted heartbeats without delivering state changes.
// Clients poll /status; provider events are durably handled by the worker.
export async function GET() {
  return NextResponse.json({ success: false, error: 'このSSE APIは廃止しました。status APIを使用してください' }, { status: 410 });
}
