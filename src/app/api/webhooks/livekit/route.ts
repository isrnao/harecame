import { NextRequest, NextResponse } from 'next/server';
import { WebhookReceiver } from 'livekit-server-sdk';
import { database } from '@/server/stream-store';
import { withErrorHandling } from '@/lib/middleware';
import { AppError } from '@/server/errors';
export const runtime = 'nodejs';
export const POST = withErrorHandling(async (request: NextRequest) => {
  const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) throw new AppError(503, 'LiveKitが未設定です');
  const body = await request.text();
  let notification;
  try { notification = await new WebhookReceiver(key, secret).receive(body, request.headers.get('authorization') ?? undefined); }
  catch { throw new AppError(401, 'Webhook署名が不正です'); }
  const room = notification.room?.name || notification.egressInfo?.roomName;
  if (!room || !notification.id) return NextResponse.json({ success: true });
  // Only persist the event ID and room; never store provider payloads with keys.
  // The worker reconciles current provider state, so old/out-of-order delivery
  // cannot roll the database back to an obsolete state.
  const { error } = await database().from('provider_notifications').upsert({ id: notification.id, room_name: room }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new AppError(503, 'Webhookを保存できません');
  return NextResponse.json({ success: true });
});
