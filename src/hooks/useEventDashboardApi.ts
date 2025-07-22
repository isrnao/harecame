import { useCallback, useRef } from 'react';
import { getYouTubeStreamStats, type YouTubeStreamStats } from '@/lib/youtube';
import type { CameraConnectionClient, StreamStatusClient } from '@/types';

interface FetchDataOptions {
  eventId: string;
  youtubeVideoId?: string;
  signal?: AbortSignal;
}

interface FetchDataResult {
  cameras: CameraConnectionClient[];
  streamStatus: StreamStatusClient | null;
  youtubeStats: YouTubeStreamStats | null;
}

/**
 * イベントダッシュボードのデータ取得を管理するフック
 */
export function useEventDashboardApi() {
  const abortControllerRef = useRef<AbortController | null>(null);

  // 前回のリクエストをキャンセルする
  const cancelPreviousRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // データを取得する
  const fetchEventData = useCallback(async (options: FetchDataOptions): Promise<FetchDataResult> => {
    const { eventId, youtubeVideoId, signal } = options;
    
    console.log('Fetching event data for:', eventId);

    const result: FetchDataResult = {
      cameras: [],
      streamStatus: null,
      youtubeStats: null,
    };

    try {
      // カメラ情報を取得
      const camerasResponse = await fetch(`/api/events/${eventId}/cameras`, { signal });
      console.log('Cameras response status:', camerasResponse.status);
      
      if (camerasResponse.ok) {
        const camerasData = await camerasResponse.json();
        result.cameras = camerasData.data || [];
        console.log('Cameras data updated:', result.cameras.length, 'cameras');
      } else {
        console.warn('Cameras fetch failed:', camerasResponse.status, camerasResponse.statusText);
      }

      // ストリーム状態を取得
      const statusResponse = await fetch(`/api/events/${eventId}/status`, { signal });
      console.log('Status response status:', statusResponse.status);
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        result.streamStatus = statusData.data;
        console.log('Stream status updated:', result.streamStatus);
      } else {
        console.warn('Status fetch failed:', statusResponse.status, statusResponse.statusText);
      }

      // YouTube統計を取得（動画IDがある場合のみ）
      if (youtubeVideoId) {
        try {
          console.log('Fetching YouTube stats for:', youtubeVideoId);
          const stats = await getYouTubeStreamStats(youtubeVideoId);
          result.youtubeStats = stats;
          console.log('YouTube stats updated:', stats);
        } catch (youtubeError) {
          console.warn('Failed to fetch YouTube stats:', youtubeError);
          // YouTube統計の取得失敗は致命的エラーとしない
        }
      }

      console.log('Event data fetch completed successfully');
      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Fetch request was aborted');
        throw error;
      }
      
      console.error('Failed to fetch event data:', error);
      throw new Error(`データの取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // 新しいリクエストを開始する（前回のリクエストをキャンセル）
  const fetchEventDataWithCancellation = useCallback(async (options: Omit<FetchDataOptions, 'signal'>): Promise<FetchDataResult> => {
    // 前回のリクエストをキャンセル
    cancelPreviousRequest();

    // 新しいAbortControllerを作成
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await fetchEventData({
        ...options,
        signal: abortController.signal,
      });
      
      // リクエストが正常に完了したらAbortControllerをクリア
      abortControllerRef.current = null;
      
      return result;
    } catch (error) {
      // エラー時もAbortControllerをクリア
      abortControllerRef.current = null;
      throw error;
    }
  }, [fetchEventData, cancelPreviousRequest]);

  // クリーンアップ
  const cleanup = useCallback(() => {
    cancelPreviousRequest();
  }, [cancelPreviousRequest]);

  return {
    fetchEventData: fetchEventDataWithCancellation,
    cancelPreviousRequest,
    cleanup,
  };
}
