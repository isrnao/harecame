'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Smartphone,
  Monitor,
  Tablet,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Clock,
  Settings
} from 'lucide-react';
import type { CameraConnectionClient } from '@/types';

interface CameraStatusGridProps {
  eventId: string;
  initialCameras?: CameraConnectionClient[];
  onCameraSelect?: (camera: CameraConnectionClient) => void;
}

export function CameraStatusGrid({
  eventId,
  initialCameras = [],
  onCameraSelect
}: CameraStatusGridProps) {
  const [cameras, setCameras] = useState<CameraConnectionClient[]>(initialCameras);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [, setIsLoading] = useState(false);

  // Refresh camera data
  const refreshCameras = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/cameras`);
      if (response.ok) {
        const data = await response.json();
        setCameras(data.data || []);
      }
    } catch (error) {
      console.error('Failed to refresh camera data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(refreshCameras, 15000);
    return () => clearInterval(interval);
  }, [eventId, refreshCameras]);

  // Initial data fetch
  useEffect(() => {
    refreshCameras();
  }, [refreshCameras]);

  const getStatusColor = (status: CameraConnectionClient['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'inactive': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: CameraConnectionClient['status']) => {
    switch (status) {
      case 'active': return 'アクティブ';
      case 'connecting': return '接続中';
      case 'inactive': return '非アクティブ';
      case 'error': return 'エラー';
      default: return '不明';
    }
  };

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

  const getSignalIcon = (quality?: { frameRate?: number; bitrate?: number }) => {
    if (!quality?.frameRate || !quality?.bitrate) {
      return <SignalLow className="h-4 w-4 text-gray-400" />;
    }

    const score = (quality.frameRate / 30) * 0.5 + (quality.bitrate / 5000) * 0.5;

    if (score > 0.8) return <Signal className="h-4 w-4 text-green-600" />;
    if (score > 0.6) return <SignalHigh className="h-4 w-4 text-blue-600" />;
    if (score > 0.3) return <SignalMedium className="h-4 w-4 text-yellow-600" />;
    return <SignalLow className="h-4 w-4 text-red-600" />;
  };

  const getConnectionQuality = (quality?: { frameRate?: number; bitrate?: number }) => {
    if (!quality?.frameRate || !quality?.bitrate) return 0;

    const frameRateScore = Math.min(quality.frameRate / 30, 1) * 50;
    const bitrateScore = Math.min(quality.bitrate / 5000, 1) * 50;

    return Math.round(frameRateScore + bitrateScore);
  };

  const handleCameraClick = (camera: CameraConnectionClient) => {
    setSelectedCamera(camera.id);
    onCameraSelect?.(camera);
  };

  // React 19: 計算結果のキャッシュ最適化 - useMemoで高価な計算をキャッシュ
  const camerasByStatus = useMemo(() => {
    const active = cameras.filter(camera => camera.status === 'active');
    const connecting = cameras.filter(camera => camera.status === 'connecting');
    const inactive = cameras.filter(camera => camera.status === 'inactive');
    const error = cameras.filter(camera => camera.status === 'error');

    return { active, connecting, inactive, error };
  }, [cameras]);

  const { active: activeCameras, connecting: connectingCameras, inactive: inactiveCameras, error: errorCameras } = camerasByStatus;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            カメラ接続状況
          </CardTitle>
          <CardDescription>
            現在接続されているカメラの状態を監視します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{activeCameras.length}</div>
              <div className="text-sm text-muted-foreground">アクティブ</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{connectingCameras.length}</div>
              <div className="text-sm text-muted-foreground">接続中</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{inactiveCameras.length}</div>
              <div className="text-sm text-muted-foreground">非アクティブ</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{errorCameras.length}</div>
              <div className="text-sm text-muted-foreground">エラー</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Camera Grid */}
      {cameras.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <VideoOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">カメラが接続されていません</h3>
            <p className="text-muted-foreground">
              参加者がカメラを接続すると、ここに表示されます
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cameras.map((camera) => (
            <Card
              key={camera.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedCamera === camera.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => handleCameraClick(camera)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(camera.deviceInfo.platform)}
                    <div>
                      <CardTitle className="text-sm">
                        {camera.participantName || camera.participantId}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {camera.deviceInfo.platform || 'Unknown'} • {camera.deviceInfo.browser || 'Unknown'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(camera.status)}>
                    {getStatusText(camera.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Connection Quality */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">接続品質</span>
                    <div className="flex items-center gap-1">
                      {getSignalIcon(camera.streamQuality)}
                      <span className="text-xs">
                        {getConnectionQuality(camera.streamQuality)}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={getConnectionQuality(camera.streamQuality)}
                    className="h-2"
                  />
                </div>

                {/* Stream Details */}
                {camera.streamQuality.resolution && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">解像度:</span>
                      <div className="font-medium">{camera.streamQuality.resolution}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">FPS:</span>
                      <div className="font-medium">{camera.streamQuality.frameRate || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ビットレート:</span>
                      <div className="font-medium">
                        {camera.streamQuality.bitrate ? `${Math.round(camera.streamQuality.bitrate / 1000)}k` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">コーデック:</span>
                      <div className="font-medium">{camera.streamQuality.codec || 'N/A'}</div>
                    </div>
                  </div>
                )}

                {/* Connection Time */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    接続: {new Date(camera.joinedAt).toLocaleTimeString('ja-JP')}
                  </span>
                </div>

                {/* Last Active */}
                {camera.status === 'active' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wifi className="h-3 w-3" />
                    <span>
                      最終アクティブ: {new Date(camera.lastActiveAt).toLocaleTimeString('ja-JP')}
                    </span>
                  </div>
                )}

                {/* Disconnected Time */}
                {camera.disconnectedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <WifiOff className="h-3 w-3" />
                    <span>
                      切断: {new Date(camera.disconnectedAt).toLocaleTimeString('ja-JP')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Selected Camera Details */}
      {selectedCamera && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              選択されたカメラの詳細
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const camera = cameras.find(c => c.id === selectedCamera);
              if (!camera) return <p>カメラが見つかりません</p>;

              return (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        参加者ID
                      </label>
                      <p className="mt-1">{camera.participantId}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        参加者名
                      </label>
                      <p className="mt-1">{camera.participantName || '未設定'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        デバイス情報
                      </label>
                      <p className="mt-1 text-sm">
                        {camera.deviceInfo.platform} • {camera.deviceInfo.browser}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        画面解像度
                      </label>
                      <p className="mt-1">{camera.deviceInfo.screenResolution || '不明'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      カメラを優先表示
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600">
                      接続を切断
                    </Button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
