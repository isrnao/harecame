import 'server-only';
import { EventService, CameraConnectionService, StreamStatusService } from '@/lib/database';
import { createEventSchema, updateEventSchema } from '@/lib/validation';
import type { EventClient } from '@/types';
import { authorize, type Actor } from './access';
import { AppError } from './errors';
import { readSession } from './stream-store';

// Explicit allowlist: participation codes and provider credentials are never public.
export function publicEvent(event: EventClient) {
  return { id: event.id, title: event.title, description: event.description,
    scheduledAt: event.scheduledAt, status: event.status,
    youtubeStreamUrl: event.youtubeStreamUrl, youtubeVideoId: event.youtubeVideoId };
}

export async function getPublicEvent(id: string) {
  const event = await EventService.getById(id);
  return event ? publicEvent(event) : null;
}

export async function listEvents(actor: Actor | null, options: Parameters<typeof EventService.list>[0] = {}) {
  authorize(actor, ['organizer']);
  if (actor.type === 'admin') return EventService.list(options);
  const event = actor.eventId ? await EventService.getById(actor.eventId) : null;
  return event ? [event] : [];
}

export async function createEvent(actor: Actor | null, input: unknown) {
  authorize(actor, []);
  const value = createEventSchema.parse(input);
  // Provisioning a provider broadcast is a separate, observable operation.
  return EventService.create({ ...value, scheduledAt: value.scheduledAt ? new Date(value.scheduledAt) : undefined });
}

export async function updateEvent(actor: Actor | null, id: string, input: unknown) {
  authorize(actor, ['organizer'], id);
  const value = updateEventSchema.strict().parse(input);
  return EventService.update(id, { ...value, scheduledAt: value.scheduledAt ? new Date(value.scheduledAt) : undefined });
}

export async function deleteEvent(actor: Actor | null, id: string) {
  authorize(actor, ['organizer'], id);
  const [event, status] = await Promise.all([EventService.getById(id), StreamStatusService.getByEventId(id)]);
  if (!event) throw new AppError(404, 'イベントが見つかりません');
  const session = await readSession(id);
  if (session && session.phase !== 'idle') throw new AppError(409, '配信履歴のあるイベントは監査のため保持します');
  if (event.status === 'live' || status?.isLive) throw new AppError(409, '配信を停止してから削除してください');
  await EventService.delete(id);
}

export async function getDashboard(actor: Actor | null, id: string) {
  authorize(actor, ['organizer'], id);
  const event = await EventService.getById(id);
  if (!event) throw new AppError(404, 'イベントが見つかりません');
  const [cameras, streamStatus] = await Promise.all([CameraConnectionService.getByEventId(id), StreamStatusService.getByEventId(id)]);
  const stale = !streamStatus?.updatedAt || Date.now() - new Date(streamStatus.updatedAt).getTime() > 90000;
  return { event, cameras, streamStatus: streamStatus && stale
    ? { ...streamStatus, isLive: false, streamHealth: 'unknown' as const } : streamStatus };
}
