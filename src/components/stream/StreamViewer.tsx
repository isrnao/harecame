'use client';

import { useState, useEffect, useMemo, useCallback, useOptimistic, startTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ViewerChat } from './ViewerChat';
import { analyticsService } from '@/lib/analytics';
import { Eye, Users, Wifi, WifiOff, Heart, ThumbsUp, Smile, Star } from 'lucide-react';

interface StreamViewerProps {
  eventId: string;
  streamUrl: string;
  eventTitle: string;
}

interface StreamStatus {
  isLive: boolean;
  activeCameraCount: number;
  viewerCount?: number;
  streamHealth: 'excellent' | 'good' | 'poor' | 'critical';
}

interface ReactionCounts {
  like: number;
  heart: number;
  smile: number;
  star: number;
}

interface ReactionState {
  counts: ReactionCounts;
  userReactions: Set<string>;
  isSubmitting: boolean;
}

export function StreamViewer({ eventId, streamUrl, eventTitle }: StreamViewerProps) {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({
    isLive: false,
    activeCameraCount: 0,
    streamHealth: 'good'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // リアクション機能の状態管理
  const [reactionState, setReactionState] = useState<ReactionState>({
    counts: { like: 0, heart: 0, smile: 0, star: 0 },
    userReactions: new Set(),
    isSubmitting: false,
  });

  // useOptimisticでリアクションの楽観的更新を実装
  const [optimisticReactions, setOptimisticReactions] = useOptimistic(
    reactionState,
    (currentState, optimisticUpdate: { type: keyof ReactionCounts; increment: boolean }) => ({
      ...currentState,
      counts: {
        ...currentState.counts,
        [optimisticUpdate.type]: optimisticUpdate.increment 
          ? currentState.counts[optimisticUpdate.type] + 1
          : Math.max(0, currentState.counts[optimisticUpdate.type] - 1)
      },
      userReactions: optimisticUpdate.increment
        ? new Set([...currentState.userReactions, optimisticUpdate.type])
        : new Set([...currentState.userReactions].filter(r => r !== optimisticUpdate.type))
    })
  );

  // YouTube動画IDの抽出をuseMemoで最適化（高価な計算のキャッシュ）
  const videoId = useMemo(() => {
    if (!streamUrl) return null;
    
    // YouTube Live URLからvideo IDを抽出
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = streamUrl.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }, [streamUrl]);

  // 視聴開始時の分析追跡
  useEffect(() => {
    // 視聴開始を記録
    analyticsService.trackInteraction({
      eventId,
      action: 'view_start',
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
            setError('イベントが見つかりません。URLを確認してください。');
          } else {
            setError('ストリーム情報の取得に失敗しました。');
          }
          return;
        }
        
        const data = await response.json();
        if (data.success && data.streamStatus) {
          setStreamStatus(data.streamStatus);
          setError(null); // エラーをクリア
        } else {
          setError('ストリーム情報の形式が正しくありません。');
        }
      } catch (err) {
        console.error('Failed to fetch stream status:', err);
        if (err instanceof TypeError && err.message.includes('fetch')) {
          setError('ネットワーク接続に問題があります。インターネット接続を確認してください。');
        } else {
          setError('ストリーム情報の取得中にエラーが発生しました。');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchStreamStatus();
    const interval = setInterval(fetchStreamStatus, 10000); // 10秒ごとに更新

    return () => clearInterval(interval);
  }, [eventId]);

  // ヘルパー関数をuseCallbackで最適化
  const getStatusColor = useCallback((health: string) => {
    switch (health) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'poor': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }, []);

  const getStatusIcon = useCallback((health: string) => {
    return health === 'critical' || health === 'poor' ? 
      <WifiOff className="h-4 w-4" /> : 
      <Wifi className="h-4 w-4" />;
  }, []);

  // ストリーム状態の派生値をuseMemoで最適化
  const streamStatusDisplay = useMemo(() => {
    return {
      statusColor: getStatusColor(streamStatus.streamHealth),
      statusIcon: getStatusIcon(streamStatus.streamHealth),
      isLive: streamStatus.isLive,
      activeCameraCount: streamStatus.activeCameraCount,
      viewerCount: streamStatus.viewerCount,
    };
  }, [streamStatus, getStatusColor, getStatusIcon]);

  // エラーハンドリング関数をuseCallbackで最適化
  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    window.location.reload();
  }, []);

  // YouTube埋め込みURLをuseMemoで最適化
  const embedUrl = useMemo(() => {
    if (!videoId) return '';
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=1&rel=0&modestbranding=1`;
  }, [videoId]);

  // アナリティクス追跡関数をuseCallbackで最適化
  const handleVideoLoad = useCallback(() => {
    // YouTube プレーヤーの読み込み完了時に分析を記録
    analyticsService.trackInteraction({
      eventId,
      action: 'view_start',
      metadata: {
        ...analyticsService.getDeviceInfo(),
        quality: analyticsService.detectVideoQuality(),
      },
    });
  }, [eventId]);

  // リアクション送信のServer Action（模擬実装）
  const sendReactionAction = useCallback(async (reactionType: keyof ReactionCounts) => {
    try {
      const response = await fetch(`/api/events/${eventId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: reactionType,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reaction');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to send reaction:', error);
      throw error;
    }
  }, [eventId]);

  // リアクションハンドラー（useOptimisticを使用した楽観的更新）
  const handleReaction = useCallback(async (reactionType: keyof ReactionCounts) => {
    if (optimisticReactions.isSubmitting) return;

    const isAlreadyReacted = optimisticReactions.userReactions.has(reactionType);
    
    startTransition(() => {
      // 楽観的更新を即座に適用
      setOptimisticReactions({
        type: reactionType,
        increment: !isAlreadyReacted
      });
    });

    try {
      // Server Actionを実行（バックグラウンドで）
      await sendReactionAction(reactionType);
      
      // 成功時は実際の状態を更新
      setReactionState(prev => ({
        ...prev,
        counts: {
          ...prev.counts,
          [reactionType]: isAlreadyReacted 
            ? Math.max(0, prev.counts[reactionType] - 1)
            : prev.counts[reactionType] + 1
        },
        userReactions: isAlreadyReacted
          ? new Set([...prev.userReactions].filter(r => r !== reactionType))
          : new Set([...prev.userReactions, reactionType])
      }));

      // アナリティクス追跡
      analyticsService.trackInteraction({
        eventId,
        action: 'view_start', // 既存のアクション型を使用
        metadata: {
          ...analyticsService.getDeviceInfo(),
        },
      });
    } catch (error) {
      // 失敗時は楽観的更新をロールバック（useOptimisticが自動で処理）
      console.error('Reaction failed, rolling back:', error);
    }
  }, [eventId, optimisticReactions.isSubmitting, optimisticReactions.userReactions, sendReactionAction, setOptimisticReactions]);

  // リアクション数を定期的に取得
  useEffect(() => {
    const fetchReactions = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}/reactions`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.reactions) {
            setReactionState(prev => ({
              ...prev,
              counts: data.reactions.counts || prev.counts,
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch reactions:', error);
      }
    };

    fetchReactions();
    const interval = setInterval(fetchReactions, 15000); // 15秒ごとに更新

    return () => clearInterval(interval);
  }, [eventId]);

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
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button 
              onClick={handleRetry}
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
            variant={streamStatusDisplay.isLive ? "default" : "secondary"}
            className={streamStatusDisplay.isLive ? "bg-red-500 hover:bg-red-600" : ""}
          >
            {streamStatusDisplay.isLive ? "🔴 ライブ配信中" : "⏸️ 配信停止中"}
          </Badge>
          
          {streamStatusDisplay.activeCameraCount > 0 && (
            <Badge variant="outline" className="flex items-center space-x-1 text-xs sm:text-sm">
              <Users className="h-3 w-3" />
              <span className="hidden sm:inline">{streamStatusDisplay.activeCameraCount}台のカメラが接続中</span>
              <span className="sm:hidden">{streamStatusDisplay.activeCameraCount}台接続中</span>
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {streamStatusDisplay.viewerCount !== undefined && (
            <Badge variant="outline" className="flex items-center space-x-1 text-xs sm:text-sm">
              <Eye className="h-3 w-3" />
              <span className="hidden sm:inline">{streamStatusDisplay.viewerCount}人が視聴中</span>
              <span className="sm:hidden">{streamStatusDisplay.viewerCount}人視聴中</span>
            </Badge>
          )}
          
          <Badge 
            variant="outline" 
            className={`flex items-center space-x-1 text-xs sm:text-sm ${streamStatusDisplay.statusColor} text-white`}
          >
            {streamStatusDisplay.statusIcon}
            <span className="hidden sm:inline">接続状態</span>
            <span className="sm:hidden">接続</span>
          </Badge>
        </div>
      </div>

      {/* メインコンテンツエリア - デスクトップでは横並び、モバイルでは縦並び */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 動画プレーヤー */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video">
                <iframe
                  src={embedUrl}
                  title={eventTitle}
                  className="w-full h-full rounded-lg"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={handleVideoLoad}
                />
              </div>
            </CardContent>
          </Card>

          {/* リアクションボタン（useOptimisticによる楽観的UI） */}
          {streamStatusDisplay.isLive && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">リアクション</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>タップして反応しよう！</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Button
                    variant={optimisticReactions.userReactions.has('like') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleReaction('like')}
                    disabled={optimisticReactions.isSubmitting}
                    className="flex items-center gap-1 min-w-[60px] touch-manipulation"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span className="text-xs">{optimisticReactions.counts.like}</span>
                  </Button>
                  
                  <Button
                    variant={optimisticReactions.userReactions.has('heart') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleReaction('heart')}
                    disabled={optimisticReactions.isSubmitting}
                    className="flex items-center gap-1 min-w-[60px] touch-manipulation"
                  >
                    <Heart className="h-4 w-4" />
                    <span className="text-xs">{optimisticReactions.counts.heart}</span>
                  </Button>
                  
                  <Button
                    variant={optimisticReactions.userReactions.has('smile') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleReaction('smile')}
                    disabled={optimisticReactions.isSubmitting}
                    className="flex items-center gap-1 min-w-[60px] touch-manipulation"
                  >
                    <Smile className="h-4 w-4" />
                    <span className="text-xs">{optimisticReactions.counts.smile}</span>
                  </Button>
                  
                  <Button
                    variant={optimisticReactions.userReactions.has('star') ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleReaction('star')}
                    disabled={optimisticReactions.isSubmitting}
                    className="flex items-center gap-1 min-w-[60px] touch-manipulation"
                  >
                    <Star className="h-4 w-4" />
                    <span className="text-xs">{optimisticReactions.counts.star}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* チャットエリア */}
        <div className="lg:col-span-1">
          <ViewerChat 
            videoId={videoId || ''}
            eventTitle={eventTitle}
            isLive={streamStatus.isLive}
            eventId={eventId}
          />
        </div>
      </div>

      {/* 配信が停止中の場合の案内 */}
      {!streamStatusDisplay.isLive && (
        <Alert>
          <AlertDescription className="text-sm">
            現在配信は停止中です。配信が開始されると自動的に表示されます。
          </AlertDescription>
        </Alert>
      )}

      {/* カメラが接続されていない場合の案内 */}
      {streamStatusDisplay.isLive && streamStatusDisplay.activeCameraCount === 0 && (
        <Alert>
          <AlertDescription className="text-sm">
            カメラオペレーターの接続を待っています。しばらくお待ちください。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}