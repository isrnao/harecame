import { AppError } from './errors';
import type { StreamSession } from './stream-store';

export interface Output { id: string; state: 'starting' | 'active' | 'ending' | 'ended' | 'failed'; }
export interface StreamPorts {
  ready(): Promise<void>;
  findStream(marker: string): Promise<{ id: string; url: string } | null>;
  createStream(title: string, marker: string): Promise<{ id: string; url: string }>;
  findBroadcast(marker: string): Promise<{ id: string } | null>;
  createBroadcast(title: string, description: string, marker: string): Promise<{ id: string }>;
  bind(broadcast: string, stream: string): Promise<void>;
  broadcastStatus(id: string): Promise<string>;
  completeBroadcast(id: string): Promise<void>;
  listOutputs(): Promise<Output[]>;
  startOutput(url: string, layout: string): Promise<Output>;
  stopOutput(id: string): Promise<void>;
  updateLayout(id: string, layout: string): Promise<void>;
  closeRoom(): Promise<void>;
}
export interface ControlContext {
  session: StreamSession;
  event: { title: string; description?: string };
  layout: string;
  hasCamera: boolean;
  save(patch: Partial<StreamSession>): Promise<void>;
  ports: StreamPorts;
}
export const isRunning = (output: Output) => ['starting', 'active', 'ending'].includes(output.state);

// Each external creation is preceded by a durable attempt marker. If the
// response is lost, reconciliation discovers the resource; it never blindly
// issues a second creation request.
export async function reconcileStream({ session: s, event, layout, hasCamera, save, ports: p }: ControlContext) {
  const marker = `[harecame:${s.event_id}]`;
  try {
    let outputs = await p.listOutputs();
    const running = outputs.filter(isRunning);
    if (s.desired === 'stopped') {
      await save({ phase: 'stopping', last_error: null });
      // Recover creations whose responses were lost before stopping anything.
      if (!s.broadcast_id && s.broadcast_creation_attempted) {
        const found = await p.findBroadcast(marker);
        if (!found) throw new AppError(409, 'YouTube作成結果が未確定です。状態確認を続けてください');
        await save({ broadcast_id: found.id });
      }
      if (s.egress_creation_attempted && !s.egress_id && outputs.length === 0) {
        throw new AppError(409, '配信出力の作成結果が未確定です。状態確認を続けてください');
      }
      if (s.broadcast_id) { await save({}); await p.completeBroadcast(s.broadcast_id); }
      for (const output of running) { await save({}); await p.stopOutput(output.id); }
      outputs = await p.listOutputs();
      if (outputs.some(isRunning)) return; // Finalization is asynchronous.
      await save({});
      await p.closeRoom();
      await save({ phase: 'stopped', last_error: null });
      return;
    }
    await p.ready();
    if (!hasCamera) throw new AppError(409, 'メイン・予備カメラの映像が届いていません。再接続を確認してください');
    if (running.length > 1) throw new AppError(409, '複数の配信出力を検出しました。停止して確認してください');
    await save({ phase: running.length ? 'starting' : 'preparing', last_error: null });
    if (!s.youtube_stream_id) {
      let stream = s.stream_creation_attempted ? await p.findStream(marker) : null;
      if (!stream) {
        if (s.stream_creation_attempted) throw new AppError(409, 'YouTubeストリーム作成結果が未確定です。再作成せず状態を確認してください');
        await save({ stream_creation_attempted: true });
        stream = await p.createStream(event.title, marker);
      }
      await save({ youtube_stream_id: stream.id, ingestion_url: stream.url });
    }
    if (!s.broadcast_id) {
      let broadcast = s.broadcast_creation_attempted ? await p.findBroadcast(marker) : null;
      if (!broadcast) {
        if (s.broadcast_creation_attempted) throw new AppError(409, 'YouTube番組作成結果が未確定です。再作成せず状態を確認してください');
        await save({ broadcast_creation_attempted: true });
        broadcast = await p.createBroadcast(event.title, event.description ?? '', marker);
      }
      await save({ broadcast_id: broadcast.id });
    }
    const ytStatus = await p.broadcastStatus(s.broadcast_id!);
    if (['complete', 'revoked', 'missing'].includes(ytStatus)) throw new AppError(409, 'YouTube番組が終了しています。新しいイベントを作成してください');
    if (ytStatus !== 'live') { await save({}); await p.bind(s.broadcast_id!, s.youtube_stream_id!); }
    let output = running[0];
    if (!output) {
      if (s.egress_creation_attempted) throw new AppError(409, '出力が停止または作成結果が未確定です。停止操作でリソースを確認してください');
      if (!s.ingestion_url) throw new AppError(503, '配信先が未設定です');
      await save({ phase: 'starting', egress_creation_attempted: true });
      output = await p.startOutput(s.ingestion_url, layout);
      await save({ egress_id: output.id });
    } else {
      await save({ egress_id: output.id });
      await p.updateLayout(output.id, layout);
    }
    if (output.state === 'ending' || output.state === 'failed' || output.state === 'ended') throw new AppError(502, '配信出力が終了しています');
    await save({ phase: output.state === 'active' && ytStatus === 'live' ? 'live' : 'starting', last_error: null });
  } catch (error) {
    // Errors from providers may contain RTMP URLs or tokens; never persist them.
    const message = error instanceof AppError ? error.message : '外部サービスとの通信に失敗しました。状態を再確認してください';
    await save({ phase: s.desired === 'stopped' ? 'stopping' : 'failed', last_error: message });
    throw error instanceof AppError ? error : new AppError(502, message);
  }
}
