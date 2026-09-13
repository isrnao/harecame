import 'server-only';
import { EgressStatus, TrackType, type ParticipantInfo } from 'livekit-server-sdk';
import { z } from 'zod';
import { EventService, CameraConnectionService, StreamStatusService } from '@/lib/database';
import { authorize, type Actor } from './access';
import { AppError } from './errors';
import { livekitServices, streamOutput } from './livekit';
import { YouTubeProvider, ingestionUrl } from './youtube';
import { database, readSession, sessionView, withStreamLease } from './stream-store';
import { reconcileStream, type Output, type StreamPorts } from './stream-controller';

export const streamCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), cameraId: z.uuid(), fallbackCameraId: z.uuid().nullable().optional() }),
  z.object({ action: z.literal('select'), cameraId: z.uuid(), fallbackCameraId: z.uuid().nullable().optional() }),
  z.object({ action: z.literal('stop') }), z.object({ action: z.literal('reconcile') }),
]);
const outputState = (state: EgressStatus): Output['state'] => {
  switch (state) {
    case EgressStatus.EGRESS_STARTING: return 'starting';
    case EgressStatus.EGRESS_ACTIVE: return 'active';
    case EgressStatus.EGRESS_ENDING: return 'ending';
    case EgressStatus.EGRESS_COMPLETE: return 'ended';
    default: return 'failed';
  }
};
function missingRoom(error: unknown) { return !!error && typeof error === 'object' && 'code' in error && error.code === 'not_found'; }

export async function reconcileEvent(eventId: string, command?: z.infer<typeof streamCommand>) {
  return withStreamLease(eventId, async (session, save) => {
    const event = await EventService.getById(eventId);
    if (!event) throw new AppError(404, 'イベントが見つかりません');
    const { rooms, egress } = livekitServices();
    const youtube = new YouTubeProvider();
    const cameras = await CameraConnectionService.getByEventId(eventId);
    if (command?.action === 'start' || command?.action === 'select') {
      if (event.status === 'ended' || session.phase === 'stopped' || session.desired === 'stopped' && command.action === 'select') throw new AppError(409, '新しいイベントから配信を開始してください');
      const ids = [command.cameraId, command.fallbackCameraId].filter(Boolean);
      if (ids.some(id => !cameras.some(c => c.id === id))) throw new AppError(403, 'このイベントのカメラを選択してください');
      if (command.cameraId === command.fallbackCameraId) throw new AppError(400, 'メインと予備には異なるカメラを選択してください');
      await save({ desired: 'live', selected_camera: command.cameraId, fallback_camera: command.fallbackCameraId ?? null });
    }
    if (command?.action === 'stop') await save({ desired: 'stopped', phase: 'stopping' });
    // LiveKit is authoritative for camera presence, including browser crashes.
    let participants: ParticipantInfo[];
    try { participants = await rooms.listParticipants(event.livekitRoomName); }
    catch (error) { if (!missingRoom(error)) {
      await save({ phase: session.desired === 'live' ? 'failed' : session.phase, last_error: 'LiveKitの接続状態を確認できません' });
      await StreamStatusService.upsert({ eventId, isLive: false, streamHealth: 'unknown' });
      throw new AppError(502, 'LiveKitの接続状態を確認できません');
    } participants = []; }
    const publishing = new Set(participants.filter(p => p.tracks.some(t => t.type === TrackType.VIDEO && !t.muted)).map(p => p.identity));
    for (const camera of cameras) {
      const active = publishing.has(camera.participantId);
      const next = active ? 'active' : camera.status === 'connecting' && Date.now() - new Date(camera.lastActiveAt).getTime() < 600000 ? 'connecting' : 'inactive';
      if (next !== camera.status) await CameraConnectionService.updateStatus(camera.id, next);
    }
    const selected = cameras.find(c => c.id === session.selected_camera);
    const fallback = cameras.find(c => c.id === session.fallback_camera);
    const current = selected && publishing.has(selected.participantId) ? selected : fallback && publishing.has(fallback.participantId) ? fallback : null;
    const layout = JSON.stringify({ primary: selected?.participantId ?? '', backup: fallback?.participantId ?? '' });
    const ports: StreamPorts = {
      ready: async () => {
        if (!process.env.APP_URL?.startsWith('https://')) throw new AppError(503, 'APP_URLに配信用ページの公開HTTPS URLを設定してください');
        await youtube.ready();
      },
      findStream: async marker => { const stream = await youtube.findStream(marker); return stream ? { id: stream.id, url: ingestionUrl(stream) } : null; },
      createStream: async (title, marker) => { const stream = await youtube.createStream(title, marker); return { id: stream.id, url: ingestionUrl(stream) }; },
      findBroadcast: marker => youtube.findBroadcast(marker),
      createBroadcast: (title, description, marker) => youtube.createBroadcast(title, description, marker),
      bind: (b, s) => youtube.bind(b, s), broadcastStatus: id => youtube.status(id), completeBroadcast: id => youtube.complete(id),
      listOutputs: async () => (await egress.listEgress({ roomName: event.livekitRoomName })).map(o => ({ id: o.egressId, state: outputState(o.status) })),
      startOutput: async (url, nextLayout) => {
        const base = process.env.APP_URL;
        if (!base || !base.startsWith('https://')) throw new AppError(503, 'APP_URLに配信用ページの公開HTTPS URLを設定してください');
        const result = await egress.startRoomCompositeEgress(event.livekitRoomName, { stream: streamOutput(url) }, {
          layout: nextLayout, customBaseUrl: `${base.replace(/\/$/, '')}/egress`,
        });
        return { id: result.egressId, state: outputState(result.status) };
      },
      stopOutput: async id => { await egress.stopEgress(id); },
      updateLayout: async (id, value) => { await egress.updateLayout(id, value); },
      closeRoom: async () => { try { await rooms.deleteRoom(event.livekitRoomName); } catch (e) { if (!missingRoom(e)) throw e; } },
    };
    try {
      if (session.desired === 'live' || session.phase !== 'idle') {
        await reconcileStream({ session, event, layout, hasCamera: !!current, save, ports });
      }
    } finally {
      await StreamStatusService.upsert({ eventId, isLive: session.phase === 'live',
        activeCameraCount: publishing.size, currentActiveCamera: current?.id ?? null,
        streamHealth: session.phase === 'failed' ? 'critical' : session.phase === 'live' ? 'good' : 'unknown' });
      if (session.broadcast_id) await EventService.update(eventId, {
        youtubeVideoId: session.broadcast_id, youtubeStreamUrl: `https://www.youtube.com/watch?v=${session.broadcast_id}`,
      });
      await EventService.update(eventId, { status: session.phase === 'stopped' ? 'ended' : session.phase === 'live' ? 'live' : 'scheduled' });
    }
    return sessionView(session);
  });
}
export async function controlStream(actor: Actor | null, eventId: string, input: unknown) {
  authorize(actor, ['organizer'], eventId);
  return reconcileEvent(eventId, streamCommand.parse(input));
}
export async function getControlState(actor: Actor | null, eventId: string) {
  authorize(actor, ['organizer'], eventId);
  return sessionView(await readSession(eventId));
}
export async function reconcilePending() {
  const { data, error } = await database().from('stream_sessions').select('event_id')
    .not('phase', 'in', '(idle,stopped)').order('updated_at').limit(10);
  if (error) throw new AppError(503, '処理対象の取得に失敗しました');
  const results = [];
  for (const row of data ?? []) {
    try { await reconcileEvent(row.event_id); results.push({ eventId: row.event_id, success: true }); }
    catch { results.push({ eventId: row.event_id, success: false }); }
  }
  return results;
}
