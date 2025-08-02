"use client";

import { useEffect, useCallback, useRef, startTransition, useReducer, useMemo, useDeferredValue } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  Square,
  Eye,
  Video,
  Wifi,
  WifiOff,
  AlertCircle,
  Clock,
  ExternalLink,
  Copy,
  RefreshCw,
} from "lucide-react";
import type {
  EventClient,
  CameraConnectionClient,
  StreamStatusClient,
} from "@/types";
import type { YouTubeStreamStats } from "@/lib/youtube";
import { StreamManagementPanel } from "./StreamManagementPanel";
import { StreamNotifications } from "./StreamNotifications";
import { useLoadingState } from "@/hooks/useLoadingState";
import { useEventDashboardApi } from "@/hooks/useEventDashboardApi";

interface EventDashboardProps {
  event: EventClient;
  initialCameras?: CameraConnectionClient[];
  initialStreamStatus?: StreamStatusClient;
}

// React 19: 複雑な状態依存関係の整理 - useReducerで状態管理を統一
interface DashboardState {
  cameras: CameraConnectionClient[];
  streamStatus: StreamStatusClient | null;
  youtubeStats: YouTubeStreamStats | null;
  lastUpdated: Date | null;
  error: string | null;
  activeCamera: CameraConnectionClient | null;
}

type DashboardAction =
  | { type: 'UPDATE_DATA'; payload: { cameras: CameraConnectionClient[]; streamStatus: StreamStatusClient | null; youtubeStats: YouTubeStreamStats | null } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_ACTIVE_CAMERA'; payload: CameraConnectionClient | null };

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'UPDATE_DATA': {
      const { cameras, streamStatus, youtubeStats } = action.payload;

      // activeCameraの計算をreducer内で実行
      const activeCameras = cameras.filter((camera) => camera.status === "active");
      let newActiveCamera: CameraConnectionClient | null = null;

      if (activeCameras.length > 0) {
        const mostRecent = activeCameras.reduce((latest, current) => {
          return new Date(current.joinedAt) > new Date(latest.joinedAt) ? current : latest;
        });

        // 現在のactiveCameraと同じ場合は変更しない（参照の安定性）
        if (state.activeCamera && state.activeCamera.id === mostRecent.id) {
          newActiveCamera = state.activeCamera;
        } else {
          newActiveCamera = mostRecent;
        }
      }

      return {
        ...state,
        cameras,
        streamStatus,
        youtubeStats,
        lastUpdated: new Date(),
        error: null, // データ更新成功時はエラーをクリア
        activeCamera: newActiveCamera,
      };
    }
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'SET_ACTIVE_CAMERA':
      return {
        ...state,
        activeCamera: action.payload,
      };
    default:
      return state;
  }
}

export function EventDashboard({
  event,
  initialCameras = [],
  initialStreamStatus,
}: EventDashboardProps) {
  // React 19: 複雑な状態依存関係の整理 - useReducerで統一的な状態管理
  const [dashboardState, dispatch] = useReducer(dashboardReducer, {
    cameras: initialCameras,
    streamStatus: initialStreamStatus || null,
    youtubeStats: null,
    lastUpdated: null,
    error: null,
    activeCamera: null,
  });

  // 分割代入で個別の状態にアクセス
  const { cameras, streamStatus, youtubeStats, lastUpdated, error, activeCamera } = dashboardState;

  // カスタムフックを使用してローディング状態を管理
  const { isLoading, withLoadingProtection } = useLoadingState(false);

  // API呼び出し管理フック
  const { fetchEventData, cleanup } = useEventDashboardApi();

  // useRefを使用してevent情報を保持し、依存関係の問題を回避
  const eventRef = useRef(event);
  const isMountedRef = useRef(true);
  eventRef.current = event;

  // データ更新の共通処理
  const updateDashboardData = useCallback(
    async (eventId: string, youtubeVideoId?: string) => {
      if (!isMountedRef.current) return;

      try {
        dispatch({ type: 'CLEAR_ERROR' });
        const result = await fetchEventData({
          eventId,
          youtubeVideoId,
        });

        if (isMountedRef.current) {
          // React 19: 計算チェーン最適化 - 関連する状態を一括更新
          startTransition(() => {
            // 状態の依存関係を考慮した順序で更新
            dispatch({
              type: 'UPDATE_DATA',
              payload: {
                cameras: result.cameras,
                streamStatus: result.streamStatus,
                youtubeStats: result.youtubeStats,
              },
            });

            // activeCameraの計算も同じバッチ内で実行される
            // （computedActiveCameraの計算により自動的に更新される）
          });
          console.log('Dashboard data updated successfully');
        }
      } catch (error) {
        if (isMountedRef.current && error instanceof Error && error.name !== 'AbortError') {
          const errorMessage = error.message || 'データの更新に失敗しました';
          // React 19: バッチング機能を活用してエラー状態更新を最適化
          startTransition(() => {
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
          });
          console.error('Failed to update dashboard data:', error);
        }
      }
    },
    [fetchEventData]
  );

  // Manual refresh function for button clicks
  const refreshData = useCallback(async () => {
    console.log('Manual refresh triggered');
    const currentEvent = eventRef.current;

    await withLoadingProtection(async () => {
      await updateDashboardData(currentEvent.id, currentEvent.youtubeVideoId);
    });
  }, [withLoadingProtection, updateDashboardData]);

  // Auto-refresh setup and initial data fetch
  useEffect(() => {
    isMountedRef.current = true;
    let intervalId: NodeJS.Timeout;

    const currentEvent = eventRef.current;
    console.log('Setting up dashboard for event:', currentEvent.id);

    // 初回データ取得
    const initializeData = async () => {
      try {
        await updateDashboardData(currentEvent.id, currentEvent.youtubeVideoId);
      } catch (error) {
        console.error('Failed to initialize dashboard data:', error);
      }
    };

    // 初回データ取得を実行
    initializeData();

    // 30秒間隔での自動更新
    const setupInterval = () => {
      intervalId = setInterval(async () => {
        if (isMountedRef.current) {
          try {
            console.log('Auto-refresh triggered');
            await updateDashboardData(currentEvent.id, currentEvent.youtubeVideoId);
          } catch (error) {
            console.error('Auto-refresh failed:', error);
          }
        }
      }, 30000);
    };

    setupInterval();

    return () => {
      console.log('Cleaning up dashboard');
      isMountedRef.current = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      cleanup();
    };
  }, [updateDashboardData, cleanup]);

  // React 19: 計算結果のキャッシュ最適化 - useMemoで高価な計算をキャッシュ
  const activeCamerasCalculated = useMemo(() =>
    cameras.filter((camera) => camera.status === "active"),
    [cameras]
  );

  // React 19: useDeferredValue(initialValue)を活用して初期値を設定
  const activeCameras = useDeferredValue(activeCamerasCalculated, []);

  const totalCameras = useMemo(() => cameras.length, [cameras]);

  // カメラ状態の統計情報は現在使用していないため削除
  // 将来の機能拡張で必要になった場合は、useMemoで実装する

  // React 19: useReducerで状態の依存関係を統一的に管理
  // activeCameraの計算はreducer内で実行されるため、ここでは不要

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // トースト通知を表示（実装時にToastProviderが必要）
      console.log("Copied to clipboard:", text);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-red-500";
      case "scheduled":
        return "bg-blue-500";
      case "ended":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "excellent":
        return "text-green-600";
      case "good":
        return "text-blue-600";
      case "poor":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stream Notifications */}
      <StreamNotifications cameras={cameras} />

      {/* Header - モバイル最適化 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            {event.title}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            イベントダッシュボード
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Badge
            className={`${getStatusColor(event.status)} text-xs sm:text-sm`}
          >
            {event.status === "live"
              ? "ライブ中"
              : event.status === "scheduled"
              ? "予定"
              : "終了"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('Update button clicked, isLoading:', isLoading);
              refreshData();
            }}
            disabled={isLoading}
            className="min-h-[36px] touch-manipulation"
          >
            <RefreshCw
              className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${
                isLoading ? "animate-spin" : ""
              }`}
            />
            <span className="hidden sm:inline">
              {isLoading ? "更新中..." : "更新"}
            </span>
            <span className="sm:hidden">
              {isLoading ? "更新中" : "更新"}
            </span>
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">接続カメラ</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCameras.length}</div>
            <p className="text-xs text-muted-foreground">
              全{totalCameras}台中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">視聴者数</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {youtubeStats?.viewerCount ||
                streamStatus?.youtubeViewerCount ||
                0}
            </div>
            <p className="text-xs text-muted-foreground">現在の視聴者</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">配信状態</CardTitle>
            {streamStatus?.isLive ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {streamStatus?.isLive ? "ライブ" : "オフライン"}
            </div>
            <p
              className={`text-xs ${getHealthColor(
                streamStatus?.streamHealth || "unknown"
              )}`}
            >
              {streamStatus?.streamHealth === "excellent"
                ? "優秀"
                : streamStatus?.streamHealth === "good"
                ? "良好"
                : streamStatus?.streamHealth === "poor"
                ? "不安定"
                : streamStatus?.streamHealth === "critical"
                ? "危険"
                : "不明"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">配信時間</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {youtubeStats?.duration || "00:00:00"}
            </div>
            <p className="text-xs text-muted-foreground">経過時間</p>
          </CardContent>
        </Card>
      </div>

      {/* Event Information - モバイル最適化 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">イベント情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                参加コード
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-base sm:text-lg font-bold text-center sm:text-left">
                  {event.participationCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(event.participationCode)}
                  className="min-h-[40px] min-w-[40px] touch-manipulation"
                  aria-label="参加コードをコピー"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {event.youtubeStreamUrl && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  配信URL
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={event.youtubeStreamUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-muted rounded-md text-xs sm:text-sm min-h-[40px]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(event.youtubeStreamUrl!)}
                    className="min-h-[40px] min-w-[40px] touch-manipulation"
                    aria-label="配信URLをコピー"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="min-h-[40px] min-w-[40px] touch-manipulation"
                  >
                    <a
                      href={event.youtubeStreamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="YouTubeで開く"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {event.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                説明
              </label>
              <p className="mt-1 text-sm">{event.description}</p>
            </div>
          )}

          {event.scheduledAt && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                開始予定時刻
              </label>
              <p className="mt-1 text-sm">
                {new Date(event.scheduledAt).toLocaleString("ja-JP")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stream Management Panel */}
      <StreamManagementPanel
        eventId={event.id}
        cameras={cameras}
        streamStatus={streamStatus}
        activeCamera={activeCamera}
        onActiveCameraChange={(camera) => dispatch({ type: 'SET_ACTIVE_CAMERA', payload: camera })}
      />

      {/* Stream Controls - モバイル最適化 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">配信コントロール</CardTitle>
          <CardDescription className="text-sm">
            配信の開始・停止を管理します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant={streamStatus?.isLive ? "secondary" : "default"}
              disabled={streamStatus?.isLive || activeCameras.length === 0}
              className="min-h-[48px] touch-manipulation flex-1 sm:flex-none"
            >
              <Play className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">配信開始</span>
              <span className="sm:hidden">開始</span>
            </Button>
            <Button
              variant="destructive"
              disabled={!streamStatus?.isLive}
              className="min-h-[48px] touch-manipulation flex-1 sm:flex-none"
            >
              <Square className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">配信停止</span>
              <span className="sm:hidden">停止</span>
            </Button>
          </div>

          {activeCameras.length === 0 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                配信を開始するには、少なくとも1台のカメラが接続されている必要があります。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-center text-sm text-muted-foreground">
          最終更新: {lastUpdated.toLocaleTimeString("ja-JP")}
        </div>
      )}
    </div>
  );
}
