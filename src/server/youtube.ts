import 'server-only';
import { AppError } from './errors';

interface Broadcast { id: string; snippet: { title: string; description?: string }; status?: { lifeCycleStatus?: string }; }
interface Stream { id: string; snippet: { title: string; description?: string }; cdn?: { ingestionInfo?: { rtmpsIngestionAddress?: string; streamName?: string } }; }
export class YouTubeProvider {
  private token?: string;
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async ready() { await this.accessToken(); }
  private async accessToken() {
    if (this.token) return this.token;
    const client_id = process.env.YOUTUBE_CLIENT_ID;
    const client_secret = process.env.YOUTUBE_CLIENT_SECRET;
    const refresh_token = process.env.YOUTUBE_REFRESH_TOKEN;
    if (!client_id || !client_secret || !refresh_token) throw new AppError(503, 'YouTubeのOAuth設定が不足しています');
    const response = await this.fetcher('https://oauth2.googleapis.com/token', {
      method: 'POST', body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(10000), cache: 'no-store',
    });
    if (!response.ok) throw new AppError(502, 'YouTube認証に失敗しました');
    const result = await response.json() as { access_token?: string };
    if (!result.access_token) throw new AppError(502, 'YouTube認証応答が不正です');
    this.token = result.access_token;
    return this.token;
  }
  private async request<T>(resource: string, params: Record<string, string>, method = 'GET', body?: unknown): Promise<T> {
    const token = await this.accessToken();
    const response = await this.fetcher(`https://www.googleapis.com/youtube/v3/${resource}?${new URLSearchParams(params)}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }), cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new AppError(502, `YouTube操作に失敗しました（HTTP ${response.status}）`);
    return response.status === 204 ? undefined as T : response.json();
  }
  // A persisted attempt marker plus lookup recovers responses lost after creation.
  async find<T extends { snippet: { description?: string } }>(resource: 'liveBroadcasts' | 'liveStreams', marker: string): Promise<T | null> {
    let pageToken = '';
    do {
      const result = await this.request<{ items: T[]; nextPageToken?: string }>(resource, {
        part: 'id,snippet,cdn'.replace(resource === 'liveBroadcasts' ? ',cdn' : '__unused__', ''),
        mine: 'true', maxResults: '50', ...(pageToken && { pageToken }),
      });
      const found = result.items.find(item => item.snippet.description?.includes(marker));
      if (found) return found;
      pageToken = result.nextPageToken ?? '';
    } while (pageToken);
    return null;
  }
  async findStream(marker: string) { return this.find<Stream>('liveStreams', marker); }
  async findBroadcast(marker: string) { return this.find<Broadcast>('liveBroadcasts', marker); }
  async createStream(title: string, marker: string) {
    return this.request<Stream>('liveStreams', { part: 'id,snippet,cdn,contentDetails' }, 'POST', {
      snippet: { title: title.slice(0, 100), description: marker },
      cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' }, contentDetails: { isReusable: false },
    });
  }
  async createBroadcast(title: string, description: string, marker: string) {
    return this.request<Broadcast>('liveBroadcasts', { part: 'id,snippet,status,contentDetails' }, 'POST', {
      snippet: { title: title.slice(0, 100), description: `${description}\n${marker}`, scheduledStartTime: new Date().toISOString() },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: true, enableAutoStop: false, enableDvr: true, recordFromStart: true,
        monitorStream: { enableMonitorStream: false } },
    });
  }
  async bind(broadcastId: string, streamId: string) {
    await this.request('liveBroadcasts/bind', { id: broadcastId, streamId, part: 'id,contentDetails' }, 'POST');
  }
  async status(id: string) {
    const result = await this.request<{ items: Broadcast[] }>('liveBroadcasts', { id, part: 'id,status' });
    if (!result.items[0]) return 'missing';
    return result.items[0].status?.lifeCycleStatus ?? 'unknown';
  }
  async complete(id: string) {
    const status = await this.status(id);
    if (status === 'complete' || status === 'revoked' || status === 'missing') return;
    if (status === 'live' || status === 'testing' || status === 'liveStarting') {
      await this.request('liveBroadcasts/transition', { id, broadcastStatus: 'complete', part: 'id,status' }, 'POST');
    } else {
      // A never-started broadcast cannot transition to complete.
      await this.request('liveBroadcasts', { id }, 'DELETE');
    }
  }
  async viewers(id: string) {
    const result = await this.request<{ items: { liveStreamingDetails?: { concurrentViewers?: string } }[] }>('videos', { id, part: 'liveStreamingDetails' });
    return Number(result.items[0]?.liveStreamingDetails?.concurrentViewers ?? 0);
  }
}
export function ingestionUrl(stream: Stream) {
  const info = stream.cdn?.ingestionInfo;
  if (!info?.rtmpsIngestionAddress || !info.streamName) throw new AppError(502, 'YouTube配信先が取得できません');
  return `${info.rtmpsIngestionAddress.replace(/\/$/, '')}/${info.streamName}`;
}
