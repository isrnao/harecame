import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { CameraConnectionService } from '@/lib/database';
import { requestActor, authorize } from '@/server/access';
import { AppError } from '@/server/errors';
import { withErrorHandling, rateLimit, RATE_LIMITS } from '@/lib/middleware';
import { updateCameraStatusSchema } from '@/lib/validation';
import { database } from '@/server/stream-store';
// Browser updates are telemetry only. Only provider reconciliation assigns presence.
export const PUT = withErrorHandling(async (request: NextRequest, context: { params: Promise<{ eventId: string; cameraId: string }> }) => {
  const { eventId, cameraId } = z.object({ eventId: z.uuid(), cameraId: z.uuid() }).parse(await context.params);
  const limited = await rateLimit(RATE_LIMITS.statusUpdate)(request); if (limited) return limited;
  const actor = await requestActor(request, eventId);
  authorize(actor, ['camera', 'organizer'], eventId);
  const camera = await CameraConnectionService.getById(cameraId);
  if (!camera || camera.eventId !== eventId) throw new AppError(404, 'カメラが見つかりません');
  if (actor.type === 'camera' && camera.participantId !== actor.sub) throw new AppError(403, '別のカメラは操作できません');
  const { streamQuality } = updateCameraStatusSchema.parse(await request.json());
  const { error } = await database().from('camera_connections').update({ last_active_at: new Date().toISOString(), ...(streamQuality && { stream_quality: streamQuality }) }).eq('id', cameraId);
  if (error) throw new AppError(503, 'カメラ情報の更新に失敗しました');
  return NextResponse.json({ success: true });
});
