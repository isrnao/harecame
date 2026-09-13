'use server';
import { headers, cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthService } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/middleware';
import { validateCameraCode, admitCamera, cameraIdentity } from '@/server/cameras';
import { publicEvent } from '@/server/events';
import { AppError } from '@/server/errors';
export type CameraJoinState = { success: boolean; message: string; errors?: { participationCode?: string[]; participantName?: string[] };
  eventId?: string; roomToken?: string; roomName?: string; cameraConnectionId?: string; authToken?: string; liveKitToken?: string };
async function limitJoin() {
  const limited = await rateLimit(RATE_LIMITS.joinEvent)(new NextRequest('https://harecame.invalid/camera/join', { method: 'POST', headers: await headers() }));
  if (limited) throw new AppError(429, '参加操作が多すぎます。少し待ってお試しください');
}
export async function joinCameraAction(_previous: CameraJoinState, form: FormData): Promise<CameraJoinState> {
  try {
    await limitJoin();
    const event = await validateCameraCode({ code: form.get('participationCode') });
    const participantName = z.string().trim().max(100).parse(form.get('participantName') ?? '');
    const jar = await cookies();
    const key = `harecame-camera-${event.id}`;
    let token = jar.get(key)?.value;
    let actor = token ? await AuthService.verifyToken(token) : null;
    if (!actor || actor.type !== 'camera' || actor.eventId !== event.id) {
      token = (await cameraIdentity(event.id, participantName)).token;
      actor = await AuthService.verifyToken(token);
    }
    const deviceInfo = Object.fromEntries(['userAgent', 'screenResolution', 'connectionType', 'platform', 'browser'].map(k => [k, String(form.get(k) ?? '').slice(0, 500)]));
    const result = await admitCamera(actor, event.id, { participantName, deviceInfo });
    jar.set(key, token!, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 28800 });
    return { success: true, message: 'イベントに参加しました', ...result };
  } catch (error) {
    return { success: false, message: error instanceof AppError ? error.message : error instanceof z.ZodError ? '入力内容を確認してください' : 'カメラの参加に失敗しました' };
  }
}
export async function getEventByParticipationCode(code: string) {
  try { await limitJoin(); return { success: true, event: publicEvent(await validateCameraCode({ code })) }; }
  catch { return { success: false, message: '参加コードを確認してください' }; }
}
