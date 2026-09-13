import 'server-only';
import { randomUUID } from 'node:crypto';
import { AuthService } from '@/lib/auth';
import { EventService, CameraConnectionService, dbCameraToClient } from '@/lib/database';
import { participationCodeSchema, joinEventSchema } from '@/lib/validation';
import { authorize, type Actor } from './access';
import { database, readSession } from './stream-store';
import { generateAccessToken } from './livekit';
import { publicEvent } from './events';
import { AppError } from './errors';
export async function validateCameraCode(input: unknown) {
  const { code } = participationCodeSchema.parse(input);
  const event = await EventService.getByParticipationCode(code);
  if (!event || event.status === 'ended') throw new AppError(404, '参加コードが見つからないか、イベントが終了しています');
  return event;
}
export async function admitCamera(actor: Actor | null, eventId: string, input: unknown) {
  authorize(actor, ['camera'], eventId);
  // Camera identity is signed by the server, never taken from a request body.
  if (actor.type !== 'camera') throw new AppError(403, '参加コードからカメラとして参加してください');
  const parsed = joinEventSchema.parse({ ...(input as Record<string, unknown>), participantId: actor.sub });
  const event = await EventService.getById(eventId);
  const session = await readSession(eventId);
  if (!event || event.status === 'ended' || session?.phase === 'stopping' || session?.phase === 'stopped') throw new AppError(409, 'このイベントのカメラ受付は終了しています');
  const { data, error } = await database().rpc('join_camera', {
    p_event_id: eventId, p_identity: actor.sub, p_name: actor.participantName ?? parsed.participantName ?? null,
    p_device: parsed.deviceInfo ?? {},
  });
  if (error) throw new AppError(409, '参加できません。カメラ台数またはイベント状態を確認してください');
  const camera = dbCameraToClient(data);
  try {
    const roomToken = await generateAccessToken(event.livekitRoomName, actor.sub, {
      canPublish: true, canSubscribe: false, canPublishData: false,
      metadata: JSON.stringify({ cameraConnectionId: camera.id }),
    });
    return { eventId, roomToken, roomName: event.livekitRoomName, cameraConnectionId: camera.id, event: publicEvent(event) };
  } catch {
    await CameraConnectionService.updateStatus(camera.id, 'inactive');
    throw new AppError(503, 'カメラ接続トークンを発行できません');
  }
}
export async function cameraIdentity(eventId: string, participantName?: string) {
  const id = randomUUID();
  const token = await AuthService.generateCameraToken(id, eventId, participantName);
  return { id, token };
}
