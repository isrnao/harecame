'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Video,
  VideoOff,
  Users,
  Eye,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Monitor,
  Smartphone,
  Tablet,
  ArrowRight,
  Clock,
  RefreshCw
} from 'lucide-react';
import type { CameraConnectionClient, StreamStatusClient } from '@/types';

interface StreamManagementPanelProps {
  eventId: string;
  cameras: CameraConnectionClient[];
  streamStatus: StreamStatusClient | null;
  activeCamera: CameraConnectionClient | null;
  onActiveCameraChange: (camera: CameraConnectionClient | null) => void;
}

interface StreamSwitchEvent {
  id: string;
  timestamp: Date;
  fromCamera: string | null;
  toCamera: string;
  reason: 'new_connection' | 'quality_improvement' | 'manual_switch' | 'disconnection';
}

export function StreamManagementPanel({
  eventId: _eventId,
  cameras,
  streamStatus: _streamStatus,
  activeCamera,
  onActiveCameraChange
}: StreamManagementPanelProps) {
  // eventId と streamStatus は将来の機能拡張のために保持
  // 現在は未使用だが、ストリーム状態の詳細管理で使用予定
  void _eventId; // 未使用パラメータを明示的に処理
  void _streamStatus; // 未使用パラメータを明示的に処理
  void onActiveCameraChange; // 将来の手動カメラ切り替え機能用
  // React 19: 状態の上位移動 - activeCamera状態は親から受け取る
  const [switchHistory, setSwitchHistory] = useState<StreamSwitchEvent[]>([]);
  const [isStandby, setIsStandby] = useState(false);
  const [lastSwitchTime, setLastSwitchTime] = useState<Date | null>(null);

  // React 19: 計算結果のキャッシュ最適化 - useMemoで高価な計算をキャッシュ
  const activeCameras = useMemo(() =>
    cameras.filter(camera => camera.status === 'active'),
    [cameras]
  );

  // Find the currently active camera
  useEffect(() => {
    if (activeCameras.length === 0) {
      setIsStandby(true);
    } else {
      // In a real implementation, this would be determined by the backend
      // For now, we'll use the most recently connected active camera
      // React 19: 状態の上位移動により、activeCamera状態は親で管理される
      setIsStandby(false);
    }
  }, [activeCameras.length]);

  // React 19: 状態の上位移動 - activeCameraの変更を監視してスイッチ履歴を更新
  const previousActiveCameraRef = useRef<CameraConnectionClient | null>(null);

  useEffect(() => {
    const previousCamera = previousActiveCameraRef.current;

    if (activeCamera && previousCamera && activeCamera.id !== previousCamera.id) {
      // Camera switch detected
      const switchEvent: StreamSwitchEvent = {
        id: `switch-${Date.now()}`,
        timestamp: new Date(),
        fromCamera: previousCamera.id,
        toCamera: activeCamera.id,
        reason: 'new_connection'
      };
      setSwitchHistory(prevHistory => [switchEvent, ...prevHistory.slice(0, 9)]); // Keep last 10 events
      setLastSwitchTime(new Date());
    }

    previousActiveCameraRef.current = activeCamera;
  }, [activeCamera]);

  const getDeviceIcon = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'mobile':
      case 'android':
      case 'ios':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      case 'desktop':
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getSwitchReasonText = (reason: StreamSwitchEvent['reason']) => {
    switch (reason) {
      case 'new_connection': return '新しい接続';
      case 'quality_improvement': return '品質向上';
      case 'manual_switch': return '手動切り替え';
      case 'disconnection': return '切断による切り替え';
      default: return '不明';
    }
  };

  const getSwitchReasonColor = (reason: StreamSwitchEvent['reason']) => {
    switch (reason) {
      case 'new_connection': return 'text-blue-600';
      case 'quality_improvement': return 'text-green-600';
      case 'manual_switch': return 'text-purple-600';
      case 'disconnection': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const standbyMessage = activeCameras.length === 0 ?
    'カメラが接続されていません' :
    'ストリーム準備中...';

  return (
    <div className="space-y-6">
      {/* Current Stream Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            現在のストリーム状況
          </CardTitle>
          <CardDescription>
            アクティブなカメラとストリーム管理の状況
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isStandby ? (
            <div className="text-center py-8">
              <VideoOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">スタンバイ画面</h3>
              <p className="text-muted-foreground mb-4">{standbyMessage}</p>
              <Badge variant="secondary" className="flex items-center gap-1 w-fit mx-auto">
                <WifiOff className="h-3 w-3" />
                待機中
              </Badge>
            </div>
          ) : activeCamera ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getDeviceIcon(activeCamera.deviceInfo?.platform)}
                  <div>
                    <h3 className="font-semibold">
                      {activeCamera.participantName || activeCamera.participantId}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {activeCamera.deviceInfo?.platform || 'Unknown'} • {activeCamera.deviceInfo?.browser || 'Unknown'}
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-500 flex items-center gap-1">
                  <Wifi className="h-3 w-3" />
                  ライブ配信中
                </Badge>
              </div>

              {/* Stream Quality Info */}
              {activeCamera.streamQuality?.resolution && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <span className="text-xs text-muted-foreground">解像度</span>
                    <div className="font-medium">{activeCamera.streamQuality.resolution}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">フレームレート</span>
                    <div className="font-medium">{activeCamera.streamQuality.frameRate || 'N/A'} fps</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">ビットレート</span>
                    <div className="font-medium">
                      {activeCamera.streamQuality.bitrate ? `${Math.round(activeCamera.streamQuality.bitrate / 1000)}k` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">コーデック</span>
                    <div className="font-medium">{activeCamera.streamQuality.codec || 'N/A'}</div>
                  </div>
                </div>
              )}

              {/* Last Switch Time */}
              {lastSwitchTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    最終切り替え: {lastSwitchTime.toLocaleTimeString('ja-JP')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground">ストリーム状況を確認中...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Cameras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            利用可能なカメラ ({activeCameras.length})
          </CardTitle>
          <CardDescription>
            接続されているカメラの一覧と切り替え管理
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCameras.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                現在接続されているカメラはありません。参加者がカメラを接続するまでお待ちください。
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {activeCameras.map((camera) => (
                <div
                  key={camera.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    activeCamera?.id === camera.id ? 'bg-green-50 border-green-200' : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getDeviceIcon(camera.deviceInfo?.platform || 'unknown')}
                    <div>
                      <div className="font-medium">
                        {camera.participantName || camera.participantId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {camera.streamQuality?.resolution || 'N/A'} •
                        {camera.streamQuality?.frameRate || 'N/A'} fps
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeCamera?.id === camera.id ? (
                      <Badge className="bg-green-500">
                        <Eye className="h-3 w-3 mr-1" />
                        配信中
                      </Badge>
                    ) : (
                      <Button variant="outline" size="sm">
                        切り替え
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Switch History */}
      {switchHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              切り替え履歴
            </CardTitle>
            <CardDescription>
              最近のカメラ切り替えイベント
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {switchHistory.map((event) => {
                const fromCamera = event.fromCamera ?
                  cameras.find(c => c.id === event.fromCamera) : null;
                const toCamera = cameras.find(c => c.id === event.toCamera);

                return (
                  <div key={event.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        {fromCamera && (
                          <>
                            <span>{fromCamera.participantName || fromCamera.participantId}</span>
                            <ArrowRight className="h-3 w-3" />
                          </>
                        )}
                        <span className="font-medium">
                          {toCamera?.participantName || toCamera?.participantId || '不明'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${getSwitchReasonColor(event.reason)}`}>
                          {getSwitchReasonText(event.reason)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {event.timestamp.toLocaleTimeString('ja-JP')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stream Management Controls */}
      <Card>
        <CardHeader>
          <CardTitle>ストリーム管理</CardTitle>
          <CardDescription>
            自動切り替えの設定と手動制御
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">自動切り替え</h4>
                <p className="text-sm text-muted-foreground">
                  新しいカメラが接続されたときに自動的に切り替える
                </p>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                有効
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">品質優先切り替え</h4>
                <p className="text-sm text-muted-foreground">
                  より高品質なストリームが利用可能になったときに切り替える
                </p>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                有効
              </Badge>
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                disabled
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                自動更新中
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
