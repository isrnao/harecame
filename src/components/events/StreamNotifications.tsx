'use client';

import { useState, useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  Info, 
  X, 
  ArrowRight,
  Video,
  VideoOff
} from 'lucide-react';
import type { CameraConnectionClient } from '@/types';

interface StreamNotification {
  id: string;
  type: 'camera_connected' | 'camera_disconnected' | 'stream_switched' | 'quality_changed' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  camera?: CameraConnectionClient;
  fromCamera?: string;
  toCamera?: string;
  autoHide?: boolean;
}

interface StreamNotificationsProps {
  cameras: CameraConnectionClient[];
}

export function StreamNotifications({ cameras }: StreamNotificationsProps) {
  const [notifications, setNotifications] = useState<StreamNotification[]>([]);
  const previousCamerasRef = useRef<CameraConnectionClient[]>([]);

  // Monitor camera changes and generate notifications
  useEffect(() => {
    const previousCameras = previousCamerasRef.current;
    
    if (previousCameras.length === 0) {
      previousCamerasRef.current = cameras;
      return;
    }

    // Deep comparison to avoid unnecessary updates
    const camerasChanged = JSON.stringify(cameras) !== JSON.stringify(previousCameras);
    if (!camerasChanged) {
      return;
    }

    const newNotifications: StreamNotification[] = [];

    // Check for new camera connections
    cameras.forEach(camera => {
      const previousCamera = previousCameras.find(prev => prev.id === camera.id);
      
      if (!previousCamera) {
        // New camera connected
        newNotifications.push({
          id: `connect-${camera.id}-${Date.now()}`,
          type: 'camera_connected',
          title: 'カメラが接続されました',
          message: `${camera.participantName || camera.participantId}が参加しました`,
          timestamp: new Date(),
          camera,
          autoHide: true
        });
      } else if (previousCamera.status !== camera.status) {
        // Camera status changed
        if (camera.status === 'active' && previousCamera.status !== 'active') {
          newNotifications.push({
            id: `activate-${camera.id}-${Date.now()}`,
            type: 'stream_switched',
            title: 'ストリームが切り替わりました',
            message: `${camera.participantName || camera.participantId}の配信に切り替わりました`,
            timestamp: new Date(),
            camera,
            autoHide: true
          });
        } else if (camera.status === 'inactive' && previousCamera.status === 'active') {
          newNotifications.push({
            id: `deactivate-${camera.id}-${Date.now()}`,
            type: 'quality_changed',
            title: 'カメラが非アクティブになりました',
            message: `${camera.participantName || camera.participantId}の配信が停止しました`,
            timestamp: new Date(),
            camera,
            autoHide: true
          });
        } else if (camera.status === 'error') {
          newNotifications.push({
            id: `error-${camera.id}-${Date.now()}`,
            type: 'error',
            title: 'カメラエラーが発生しました',
            message: `${camera.participantName || camera.participantId}で接続エラーが発生しました`,
            timestamp: new Date(),
            camera,
            autoHide: false
          });
        }
      }
    });

    // Check for disconnected cameras
    previousCameras.forEach(previousCamera => {
      const currentCamera = cameras.find(current => current.id === previousCamera.id);
      
      if (!currentCamera) {
        // Camera disconnected
        newNotifications.push({
          id: `disconnect-${previousCamera.id}-${Date.now()}`,
          type: 'camera_disconnected',
          title: 'カメラが切断されました',
          message: `${previousCamera.participantName || previousCamera.participantId}が退出しました`,
          timestamp: new Date(),
          camera: previousCamera,
          autoHide: true
        });
      }
    });

    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev].slice(0, 10)); // Keep last 10 notifications
    }

    previousCamerasRef.current = cameras;
  }, [cameras]);

  // Auto-hide notifications after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setNotifications(prev => 
        prev.filter(notification => 
          !notification.autoHide || 
          Date.now() - notification.timestamp.getTime() < 5000
        )
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [notifications]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const getNotificationIcon = (type: StreamNotification['type']) => {
    switch (type) {
      case 'camera_connected':
        return <Video className="h-4 w-4 text-green-600" />;
      case 'camera_disconnected':
        return <VideoOff className="h-4 w-4 text-red-600" />;
      case 'stream_switched':
        return <ArrowRight className="h-4 w-4 text-blue-600" />;
      case 'quality_changed':
        return <Info className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: StreamNotification['type']) => {
    switch (type) {
      case 'camera_connected':
        return 'border-green-200 bg-green-50';
      case 'camera_disconnected':
        return 'border-red-200 bg-red-50';
      case 'stream_switched':
        return 'border-blue-200 bg-blue-50';
      case 'quality_changed':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <Alert 
          key={notification.id}
          className={`${getNotificationColor(notification.type)} shadow-lg animate-in slide-in-from-right-full duration-300`}
        >
          <div className="flex items-start gap-3">
            {getNotificationIcon(notification.type)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{notification.title}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-transparent"
                  onClick={() => dismissNotification(notification.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <AlertDescription className="text-xs mt-1">
                {notification.message}
              </AlertDescription>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">
                  {notification.timestamp.toLocaleTimeString('ja-JP')}
                </span>
                {notification.camera && (
                  <Badge variant="outline" className="text-xs">
                    {notification.camera.deviceInfo.platform}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </Alert>
      ))}
    </div>
  );
}