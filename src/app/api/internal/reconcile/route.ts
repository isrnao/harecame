import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { reconcileEvent, reconcilePending } from '@/server/streaming';
import { database } from '@/server/stream-store';
import { withErrorHandling } from '@/lib/middleware';
import { AppError } from '@/server/errors';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const POST = withErrorHandling(async (request: NextRequest) => {
  const expected = process.env.RECONCILE_SECRET;
  const actual = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!expected || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) throw new AppError(401, '認証が必要です');
  const { data: notifications, error } = await database().from('provider_notifications').select('id,room_name').is('processed_at', null).order('received_at').limit(50);
  if (error) throw new AppError(503, 'Webhookを取得できません');
  const roomNames = [...new Set((notifications ?? []).map(n => n.room_name))];
  for (const name of roomNames) {
    const { data: event, error: lookupError } = await database().from('events').select('id').eq('livekit_room_name', name).maybeSingle();
    if (lookupError) continue;
    try {
      if (event) await reconcileEvent(event.id);
      await database().from('provider_notifications').update({ processed_at: new Date().toISOString() })
        .in('id', (notifications ?? []).filter(n => n.room_name === name).map(n => n.id));
    } catch { /* Leave persisted notifications for the next attempt. */ }
  }
  const results = await reconcilePending();
  await database().from('provider_notifications').delete().lt('processed_at', new Date(Date.now() - 7 * 86400000).toISOString());
  return NextResponse.json({ success: true, data: results });
});
