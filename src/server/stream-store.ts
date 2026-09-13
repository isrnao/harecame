import 'server-only';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { AppError } from './errors';
export type StreamPhase = 'idle' | 'preparing' | 'starting' | 'live' | 'stopping' | 'stopped' | 'failed';
export interface StreamSession {
  event_id: string; phase: StreamPhase; desired: 'live' | 'stopped';
  selected_camera: string | null; fallback_camera: string | null;
  egress_id: string | null; broadcast_id: string | null; youtube_stream_id: string | null;
  ingestion_url: string | null; stream_creation_attempted: boolean;
  broadcast_creation_attempted: boolean; egress_creation_attempted: boolean;
  last_error: string | null; updated_at: string;
}
export function database() {
  if (!supabaseAdmin) throw new AppError(503, 'データベースが未設定です');
  return supabaseAdmin;
}
export async function readSession(eventId: string): Promise<StreamSession | null> {
  const { data, error } = await database().from('stream_sessions').select('*').eq('event_id', eventId).maybeSingle();
  if (error) throw new AppError(503, '配信状態を取得できません。DBマイグレーションを確認してください');
  return data;
}
export function sessionView(session: StreamSession | null) {
  return { phase: session?.phase ?? 'idle', desired: session?.desired ?? 'stopped',
    selectedCamera: session?.selected_camera ?? null, fallbackCamera: session?.fallback_camera ?? null,
    watchUrl: session?.broadcast_id ? `https://www.youtube.com/watch?v=${session.broadcast_id}` : null,
    lastError: session?.last_error ?? null, updatedAt: session?.updated_at ?? null };
}
export async function withStreamLease<T>(eventId: string, work: (session: StreamSession, save: (patch: Partial<StreamSession>) => Promise<void>) => Promise<T>) {
  const token = randomUUID();
  const { data: locked, error } = await database().rpc('acquire_stream_lease', { p_event_id: eventId, p_token: token });
  if (error) throw new AppError(503, '配信制御DBに接続できません');
  if (!locked) throw new AppError(409, '配信処理中です。しばらく待って再確認してください');
  try {
    const session = await readSession(eventId);
    if (!session) throw new AppError(503, '配信状態が見つかりません');
    const save = async (patch: Partial<StreamSession>) => {
      const { data, error } = await database().from('stream_sessions').update({ ...patch, lease_until: new Date(Date.now() + 120000).toISOString() }).eq('event_id', eventId)
        .eq('lease_token', token).gt('lease_until', new Date().toISOString()).select('event_id').maybeSingle();
      if (error || !data) throw new AppError(409, '配信処理のロックが失効しました。状態を再確認してください');
      Object.assign(session, patch);
    };
    return await work(session, save);
  } finally {
    await database().from('stream_sessions').update({ lease_token: null, lease_until: null }).eq('event_id', eventId).eq('lease_token', token);
  }
}
