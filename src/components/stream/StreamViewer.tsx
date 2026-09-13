"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ViewerChat } from "./ViewerChat";
import { analyticsService } from "@/lib/analytics";
import { Eye, Users, Wifi, WifiOff } from "lucide-react";

interface StreamViewerProps {
  eventId: string;
  streamUrl: string;
  eventTitle: string;
}

interface StreamStatus {
  isLive: boolean;
  activeCameraCount: number;
  viewerCount?: number;
  streamHealth: "excellent" | "good" | "poor" | "critical";
}

export function StreamViewer({
  eventId,
  streamUrl,
  eventTitle,
}: StreamViewerProps) {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({
    isLive: false,
    activeCameraCount: 0,
    streamHealth: "good",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // YouTube動画IDを抽出する関数
  const extractVideoId = (url: string): string | null => {
    if (!url) return null;

    // YouTube Live URLからvideo IDを抽出
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1] ?? null;
    }

    return null;
  };

  const [observedVideoId, setObservedVideoId] = useState<string | null>(null);
  const videoId = observedVideoId || extractVideoId(streamUrl);

  // 視聴開始時の分析追跡
  useEffect(() => {
    // 視聴開始を記録
    analyticsService.trackInteraction({
      eventId,
      action: "view_start",
      metadata: analyticsService.getDeviceInfo(),
    });

    // コンポーネントのアンマウント時にクリーンアップ
    return () => {
      analyticsService.cleanup(eventId);
    };
  }, [eventId]);

  // ストリーム状態を定期的に取得
  useEffect(() => {
    const fetchStreamStatus = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/status`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("イベントが見つかりません。URLを確認してください。");
          } else {
            setError("ストリーム情報の取得に失敗しました。");
          }
          return;
        }

        const data = await response.json();
        if (data.success && data.data) {
          setStreamStatus({ ...data.data, viewerCount: data.data.youtubeViewerCount });
          setObservedVideoId(data.data.youtubeVideoId ?? null);
          setError(null); // エラーをクリア
        } else {
          setError("ストリーム情報の形式が正しくありません。");
        }
      } catch (err) {
        console.error("Failed to fetch stream status:", err);
        if (err instanceof TypeError && err.message.includes("fetch")) {
          setError(
            "ネットワーク接続に問題があります。インターネット接続を確認してください。"
          );
        } else {
          setError("ストリーム情報の取得中にエラーが発生しました。");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreamStatus();
    const interval = setInterval(fetchStreamStatus, 10000); // 10秒ごとに更新

    return () => clearInterval(interval);
  }, [eventId]);

  const getStatusColor = (health: string) => {
    switch (health) {
      case "excellent":
        return "bg-green-500";
      case "good":
        return "bg-blue-500";
      case "poor":
        return "bg-yellow-500";
      case "critical":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (health: string) => {
    return health === "critical" || health === "poor" ? (
      <WifiOff className="h-4 w-4" />
    ) : (
      <Wifi className="h-4 w-4" />
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">ストリームを読み込み中...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                window.location.reload();
              }}
              variant="outline"
              size="sm"
            >
              再読み込み
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!videoId) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>
              ストリームがまだ開始されていません。しばらくお待ちください。
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              更新
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ストリーム状態表示 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={streamStatus.isLive ? "default" : "secondary"}
            className={streamStatus.isLive ? "bg-red-500 hover:bg-red-600" : ""}
          >
            {streamStatus.isLive ? "🔴 ライブ配信中" : "⏸️ 配信停止中"}
          </Badge>

          {streamStatus.activeCameraCount > 0 && (
            <Badge
              variant="outline"
              className="flex items-center space-x-1 text-xs sm:text-sm"
            >
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">
                {streamStatus.activeCameraCount}台のカメラが接続中
              </span>
              <span className="sm:hidden">
                {streamStatus.activeCameraCount}台接続中
              </span>
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {streamStatus.viewerCount !== undefined && (
            <Badge
              variant="outline"
              className="flex items-center space-x-1 text-xs sm:text-sm"
            >
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">
                {streamStatus.viewerCount}人が視聴中
              </span>
              <span className="sm:hidden">
                {streamStatus.viewerCount}人視聴中
              </span>
            </Badge>
          )}

          <Badge
            variant="outline"
            className={`flex items-center space-x-1 text-xs sm:text-sm ${getStatusColor(
              streamStatus.streamHealth
            )} text-white`}
          >
            {getStatusIcon(streamStatus.streamHealth)}
            <span className="hidden sm:inline">接続状態</span>
            <span className="sm:hidden">接続</span>
          </Badge>
        </div>
      </div>

      {/* メインコンテンツエリア - デスクトップでは横並び、モバイルでは縦並び */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 動画プレーヤー */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1`}
                  title={eventTitle}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => {
                    // YouTube プレーヤーの読み込み完了時に分析を記録
                    analyticsService.trackInteraction({
                      eventId,
                      action: "view_start",
                      metadata: {
                        ...analyticsService.getDeviceInfo(),
                        quality: analyticsService.detectVideoQuality(),
                      },
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* チャットエリア */}
        <div className="lg:col-span-1">
          <ViewerChat
            videoId={videoId || ""}
            eventTitle={eventTitle}
            isLive={streamStatus.isLive}
            eventId={eventId}
          />
        </div>
      </div>

      {/* 配信が停止中の場合の案内 */}
      {!streamStatus.isLive && (
        <Alert>
          <AlertDescription className="text-sm">
            現在配信は停止中です。配信が開始されると自動的に表示されます。
          </AlertDescription>
        </Alert>
      )}

      {/* カメラが接続されていない場合の案内 */}
      {streamStatus.isLive && streamStatus.activeCameraCount === 0 && (
        <Alert>
          <AlertDescription className="text-sm">
            カメラオペレーターの接続を待っています。しばらくお待ちください。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
