import { useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { CameraConnectionClient, StreamStatusClient } from '@/types';
export function useEventDashboardApi() {
  const current = useRef<AbortController | null>(null);
  const cleanup = useCallback(() => current.current?.abort(), []);
  const fetchEventData = useCallback(async ({ eventId }: { eventId: string; youtubeVideoId?: string }) => {
    current.current?.abort(); const controller = new AbortController(); current.current = controller;
    try {
      const result = await apiRequest<{ cameras: CameraConnectionClient[]; streamStatus: StreamStatusClient | null }>(`/api/events/${eventId}?include_cameras=true&include_status=true`, { signal: controller.signal });
      return { cameras: result.cameras, streamStatus: result.streamStatus, youtubeStats: null };
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      throw new Error('データの取得に失敗しました。ログイン状態と接続を確認してください');
    }
  }, []);
  return { fetchEventData, cleanup, cancelPreviousRequest: cleanup };
}
