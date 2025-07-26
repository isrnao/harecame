"use client";

import { useState, useEffect, useRef, useCallback, useOptimistic, startTransition } from "react";
import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  LocalAudioTrack,
  ConnectionState,
  ConnectionQuality,
  Track,
  DisconnectReason,
} from "livekit-client";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { CameraPermissionError } from "@/components/error/CameraPermissionError";
import { 
  useMediaPermissionHandler
} from "@/lib/event-handlers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Wifi,
  WifiOff,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface CameraStreamInterfaceProps {
  roomToken: string;
  roomName: string;
  eventId: string;
  eventTitle: string;
  participantName?: string;
}

interface StreamStats {
  resolution: string;
  frameRate: number;
  bitrate: number;
  codec: string;
  packetsLost: number;
  jitter: number;
}

export function CameraStreamInterface({
  roomToken,
  roomName,
  eventId,
  eventTitle,
  participantName,
}: CameraStreamInterfaceProps) {
  console.log("CameraStreamInterface initialized with:", {
    roomToken: roomToken ? "present" : "missing",
    roomName,
    eventId,
    eventTitle,
    participantName,
  });

  // roomTokenやeventIdの変更時に状態をリセットするため、これらをkeyとして使用
  // レンダリング中の状態調整: 前回のpropsと比較して変更があった場合の処理
  const [prevProps, setPrevProps] = useState({ roomToken, eventId });
  
  // レンダリング中の状態調整 - propsが変更された場合の処理
  if (prevProps.roomToken !== roomToken || prevProps.eventId !== eventId) {
    console.log("Props changed, resetting component state:", {
      prevRoomToken: prevProps.roomToken ? "present" : "missing",
      newRoomToken: roomToken ? "present" : "missing",
      prevEventId: prevProps.eventId,
      newEventId: eventId,
    });
    
    // 前回のpropsを更新
    setPrevProps({ roomToken, eventId });
    
    // 状態をリセット（接続状態は保持して、新しいトークンで再接続を促す）
    // これにより、useEffectでの複雑な依存関係管理を避けることができる
  }
  
  const [room] = useState(() => new Room());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    ConnectionQuality.Unknown
  );

  // 接続状態の楽観的更新用のuseOptimistic
  const [optimisticConnectionState, setOptimisticConnectionState] = useOptimistic(
    { isConnected, isConnecting },
    (currentState, optimisticUpdate: { isConnected?: boolean; isConnecting?: boolean }) => ({
      ...currentState,
      ...optimisticUpdate,
    })
  );
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<Error | null>(null);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [cameraConnectionId, setCameraConnectionId] = useState<string | null>(
    null
  );
  const [isMediaInitialized, setIsMediaInitialized] = useState(false);
  const [isInitializingMedia, setIsInitializingMedia] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);

  // React 19のref cleanup機能を活用したリソース管理
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  // React 19のref cleanup機能を使用したビデオ要素の管理
  const videoRefCallback = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    
    if (!element) return;
    
    // ビデオ要素の初期化
    element.playsInline = true;
    element.muted = true;
    element.autoplay = true;
    
    // クリーンアップ関数を返す（React 19の新機能）
    return () => {
      console.log('Video element cleanup');
      if (element.srcObject) {
        const stream = element.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        element.srcObject = null;
      }
    };
  }, []);
  
  const localVideoTrack = useRef<LocalVideoTrack | null>(null);
  const localAudioTrack = useRef<LocalAudioTrack | null>(null);

  // デバイス向き検出
  const deviceOrientation = useDeviceOrientation();

  // ネットワーク品質検出
  const { networkQuality, recommendedQuality } = useNetworkQuality();

  // ネットワーク状態監視
  const { retryWithBackoff } = useNetworkStatus();

  // 共通のメディア権限ハンドラーを使用
  const handleMediaPermission = useMediaPermissionHandler(
    (stream) => {
      console.log("Media stream obtained successfully");
      console.log("Video tracks:", stream.getVideoTracks().length);
      console.log("Audio tracks:", stream.getAudioTracks().length);

      // Create LiveKit tracks from the stream
      const videoTrack = new LocalVideoTrack(stream.getVideoTracks()[0]);
      const audioTrack = new LocalAudioTrack(stream.getAudioTracks()[0]);

      localVideoTrack.current = videoTrack;
      localAudioTrack.current = audioTrack;

      // Display local video - 確実にビデオを表示するための改善
      if (videoRef.current && stream.getVideoTracks().length > 0) {
        console.log("Setting video source to video element");
        videoRef.current.srcObject = stream;

        // ビデオの再生を確実に開始
        videoRef.current.play().then(() => {
          console.log("Video playback started successfully");
        }).catch((playError) => {
          console.error("Failed to start video playback:", playError);
          // ユーザーの操作が必要な場合もあるため、エラーは警告として扱う
        });

        // ビデオが読み込まれたことを確認
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded, dimensions:", {
            width: videoRef.current?.videoWidth,
            height: videoRef.current?.videoHeight,
          });
        };
      } else {
        console.warn("Video ref not available or no video tracks");
      }

      console.log("Local video preview started");
      setIsMediaInitialized(true);
    },
    (error) => {
      setError(error.message);
      if (error.code === 'PERMISSION_DENIED' || error.code === 'DEVICE_NOT_FOUND' || error.code === 'DEVICE_IN_USE') {
        setMediaError(new Error(error.message));
        const errorWithName = setMediaError as typeof setMediaError & { name?: string };
        errorWithName.name = error.code;
      }
      setIsMediaInitialized(false);
    }
  );

  // Initialize camera and microphone using common handler
  const initializeMedia = useCallback(async () => {
    setError(null);
    setMediaError(null);
    console.log("Requesting camera and microphone permissions...");

    // ネットワーク品質に基づく動的品質調整
    const videoConstraints = {
      width: { ideal: recommendedQuality.width },
      height: { ideal: recommendedQuality.height },
      frameRate: { ideal: recommendedQuality.frameRate },
    };

    console.log("Using video quality based on network:", {
      network: networkQuality.effectiveType,
      quality: recommendedQuality,
    });

    const constraints: MediaStreamConstraints = {
      video: videoConstraints,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    const result = await handleMediaPermission(constraints);
    
    if (result.success && result.data) {
      const stream = result.data;
      const videoTrack = new LocalVideoTrack(stream.getVideoTracks()[0]);
      const audioTrack = new LocalAudioTrack(stream.getAudioTracks()[0]);
      return { videoTrack, audioTrack };
    } else {
      throw new Error(result.error?.message || 'Failed to initialize media');
    }
  }, [recommendedQuality, networkQuality, handleMediaPermission]);

  // Connect to LiveKit room with retry logic and optimistic updates
  const connectToRoom = useCallback(async () => {
    if (optimisticConnectionState.isConnecting || optimisticConnectionState.isConnected) return;

    // 楽観的更新を即座に適用
    startTransition(() => {
      setOptimisticConnectionState({ isConnecting: true, isConnected: false });
    });

    setIsConnecting(true);
    setError(null);
    setIsDisconnected(false);

    try {
      // Initialize media first
      const { videoTrack, audioTrack } = await initializeMedia();

      console.log("Attempting to connect to LiveKit room:", {
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
        roomName: roomName,
        hasToken: !!roomToken,
      });

      // Connect to room with retry logic
      await retryWithBackoff(
        async () => {
          await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, roomToken);
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffFactor: 2,
        }
      );

      console.log("Successfully connected to LiveKit room");

      // Publish tracks with retry logic
      await retryWithBackoff(
        async () => {
          await room.localParticipant.publishTrack(videoTrack, {
            name: "camera",
            source: Track.Source.Camera,
          });

          await room.localParticipant.publishTrack(audioTrack, {
            name: "microphone",
            source: Track.Source.Microphone,
          });
        },
        {
          maxRetries: 2,
          baseDelay: 500,
          maxDelay: 2000,
          backoffFactor: 2,
        }
      );

      console.log("Successfully published video and audio tracks");

      setIsConnected(true);
    } catch (error) {
      console.error("Failed to connect to room:", error);

      // 接続に失敗した場合、メディアトラックもクリーンアップ
      if (localVideoTrack.current) {
        localVideoTrack.current.stop();
        localVideoTrack.current = null;
      }
      if (localAudioTrack.current) {
        localAudioTrack.current.stop();
        localAudioTrack.current = null;
      }

      // 状態をリセット
      setIsConnected(false);

      if (error instanceof Error) {
        if (error.message.includes("WebSocket")) {
          setError(
            "LiveKitサーバーに接続できません。ネットワーク接続を確認して再試行してください。"
          );
        } else if (error.message.includes("token")) {
          setError("認証トークンが無効です。再度参加してください。");
        } else if (error.message.includes("timeout")) {
          setError(
            "接続がタイムアウトしました。ネットワーク接続を確認してください。"
          );
        } else {
          setError(`配信への接続に失敗しました: ${error.message}`);
        }
      } else {
        setError(
          "配信への接続に失敗しました。ネットワーク接続を確認してください。"
        );
      }
    } finally {
      setIsConnecting(false);
    }
  }, [
    optimisticConnectionState.isConnecting,
    optimisticConnectionState.isConnected,
    setOptimisticConnectionState,
    initializeMedia,
    roomName,
    roomToken,
    room,
    retryWithBackoff,
  ]);

  // Disconnect from room with optimistic updates
  const disconnectFromRoom = useCallback(async () => {
    // 楽観的更新を即座に適用
    startTransition(() => {
      setOptimisticConnectionState({ isConnected: false, isConnecting: false });
    });

    try {
      console.log("Disconnecting from room, current state:", {
        isConnected,
        roomState: room.state,
        hasLocalVideoTrack: !!localVideoTrack.current,
        hasLocalAudioTrack: !!localAudioTrack.current,
      });

      // Stop local tracks first
      if (localVideoTrack.current) {
        console.log("Stopping local video track");
        localVideoTrack.current.stop();
        localVideoTrack.current = null;
      }
      if (localAudioTrack.current) {
        console.log("Stopping local audio track");
        localAudioTrack.current.stop();
        localAudioTrack.current = null;
      }

      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Reset video playing state
      setIsVideoPlaying(false);

      // Only disconnect if actually connected or connecting
      if (room.state !== ConnectionState.Disconnected) {
        console.log(
          "Disconnecting from LiveKit room, current state:",
          room.state
        );
        await room.disconnect();
      } else {
        console.log("Room already disconnected, skipping disconnect call");
      }

      setIsConnected(false);
      setIsConnecting(false);
      setIsDisconnected(true);
      // メディアは初期化されたままにして、再接続時に再利用できるようにする

      // リソース監視のクリーンアップ
      const cleanup = (
        window as unknown as {
          harecameCleanup?: { connection: () => void; stream: () => void };
        }
      ).harecameCleanup;
      if (cleanup) {
        cleanup.connection();
        cleanup.stream();
        delete (window as unknown as { harecameCleanup?: unknown })
          .harecameCleanup;
      }

      console.log("Room disconnection completed");
    } catch (error) {
      console.error("Failed to disconnect from room:", error);
      // Even if disconnect fails, reset local state
      setIsConnected(false);
      setIsMediaInitialized(false);
    }
  }, [isConnected, room, setOptimisticConnectionState]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localVideoTrack.current) return;

    try {
      if (isVideoEnabled) {
        await localVideoTrack.current.mute();
      } else {
        await localVideoTrack.current.unmute();
      }
      setIsVideoEnabled(!isVideoEnabled);
    } catch (error) {
      console.error("Failed to toggle video:", error);
    }
  }, [isVideoEnabled]);

  // Toggle audio
  const toggleAudio = useCallback(async () => {
    if (!localAudioTrack.current) return;

    try {
      if (isAudioEnabled) {
        await localAudioTrack.current.mute();
      } else {
        await localAudioTrack.current.unmute();
      }
      setIsAudioEnabled(!isAudioEnabled);
    } catch (error) {
      console.error("Failed to toggle audio:", error);
    }
  }, [isAudioEnabled]);

  // Update camera connection status in database
  const updateCameraStatus = useCallback(
    async (status: "active" | "inactive" | "error") => {
      if (!cameraConnectionId) return;

      try {
        const streamQuality = streamStats
          ? {
              resolution: streamStats.resolution,
              frameRate: streamStats.frameRate,
              bitrate: streamStats.bitrate,
              codec: streamStats.codec,
            }
          : undefined;

        await fetch(
          `/api/events/${eventId}/cameras/${cameraConnectionId}/status`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status,
              streamQuality,
            }),
          }
        );
      } catch (error) {
        console.error("Failed to update camera status:", error);
      }
    },
    [cameraConnectionId, streamStats, eventId]
  );

  // Get connection quality icon
  const getConnectionQualityIcon = () => {
    switch (connectionQuality) {
      case ConnectionQuality.Excellent:
        return <Signal className="h-4 w-4 text-green-600" />;
      case ConnectionQuality.Good:
        return <SignalHigh className="h-4 w-4 text-blue-600" />;
      case ConnectionQuality.Poor:
        return <SignalMedium className="h-4 w-4 text-yellow-600" />;
      default:
        return <SignalLow className="h-4 w-4 text-red-600" />;
    }
  };

  // Get connection quality text
  const getConnectionQualityText = () => {
    switch (connectionQuality) {
      case ConnectionQuality.Excellent:
        return "優秀";
      case ConnectionQuality.Good:
        return "良好";
      case ConnectionQuality.Poor:
        return "不安定";
      default:
        return "不明";
    }
  };

  // Get connection quality percentage
  const getConnectionQualityPercentage = () => {
    switch (connectionQuality) {
      case ConnectionQuality.Excellent:
        return 100;
      case ConnectionQuality.Good:
        return 75;
      case ConnectionQuality.Poor:
        return 50;
      default:
        return 25;
    }
  };

  // Update stream statistics
  const updateStreamStats = useCallback(async () => {
    if (!isConnected || !localVideoTrack.current) return;

    try {
      const videoTrack = localVideoTrack.current;
      const trackSid = videoTrack.sid;

      if (!trackSid) {
        console.warn("Video track SID not available yet");
        return;
      }

      const publication =
        room.localParticipant.videoTrackPublications.get(trackSid);
      const sender = publication?.track?.sender;

      if (sender) {
        const stats = await sender.getStats();

        for (const report of stats.values()) {
          if (report.type === "outbound-rtp" && report.mediaType === "video") {
            const resolution = `${report.frameWidth || 0}x${
              report.frameHeight || 0
            }`;
            const frameRate = report.framesPerSecond || 0;
            const bitrate = report.bytesSent
              ? (report.bytesSent * 8) / 1000
              : 0; // Convert to kbps
            const codec = report.codecId || "unknown";
            const packetsLost = report.packetsLost || 0;
            const jitter = report.jitter || 0;

            setStreamStats({
              resolution,
              frameRate,
              bitrate,
              codec,
              packetsLost,
              jitter,
            });
            break;
          }
        }
      }
    } catch (error) {
      console.error("Failed to get stream stats:", error);
    }
  }, [isConnected, room]);

  // WebSocket接続管理の最適化 - React 19のref cleanup機能を活用
  const roomEventListenersRef = useRef<{
    cleanup: (() => void) | null;
  }>({ cleanup: null });

  // Set up room event listeners with improved resource management
  useEffect(() => {
    const handleConnectionStateChanged = (state: ConnectionState) => {
      console.log("Room connection state changed:", state);
      setConnectionState(state);
      if (state === ConnectionState.Disconnected) {
        setIsConnected(false);
        // 楽観的状態も更新
        startTransition(() => {
          setOptimisticConnectionState({ isConnected: false, isConnecting: false });
        });
      }
    };

    const handleConnectionQualityChanged = (quality: ConnectionQuality) => {
      console.log("Connection quality changed:", quality);
      setConnectionQuality(quality);
    };

    const handleDisconnected = (reason?: DisconnectReason) => {
      console.log("Room disconnected event received, reason:", reason);
      setIsConnected(false);
      setIsConnecting(false);
      
      // 楽観的状態も更新
      startTransition(() => {
        setOptimisticConnectionState({ isConnected: false, isConnecting: false });
      });

      // 切断理由に応じたエラーメッセージ
      if (reason) {
        const reasonString = reason.toString();
        if (reasonString.includes('WEBSOCKET') || reasonString.includes('websocket')) {
          setError("ネットワーク接続が不安定です。再接続してください。");
        } else if (reasonString.includes('TOKEN') || reasonString.includes('token')) {
          setError("認証トークンが期限切れです。再度参加してください。");
        } else {
          setError(`配信から切断されました: ${reasonString}`);
        }
      } else {
        setError("配信から切断されました");
      }
    };

    const handleReconnecting = () => {
      console.log("Room reconnecting...");
      setError("接続を復旧中...");
      startTransition(() => {
        setOptimisticConnectionState({ isConnecting: true, isConnected: false });
      });
    };

    const handleReconnected = () => {
      console.log("Room reconnected successfully");
      setError(null);
      setIsConnected(true);
      startTransition(() => {
        setOptimisticConnectionState({ isConnected: true, isConnecting: false });
      });
    };



    // イベントリスナーを安全に追加
    if (room) {
      room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.on(RoomEvent.Disconnected, handleDisconnected);
      room.on(RoomEvent.Reconnecting, handleReconnecting);
      room.on(RoomEvent.Reconnected, handleReconnected);
      
      // WebSocketエラーイベントも監視
      // Note: LiveKitのengine構造が変更されたため、WebSocketエラーイベントの監視は省略

      // クリーンアップ関数を保存
      roomEventListenersRef.current.cleanup = () => {
        console.log("Cleaning up room event listeners");
        room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
        room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
        room.off(RoomEvent.Disconnected, handleDisconnected);
        room.off(RoomEvent.Reconnecting, handleReconnecting);
        room.off(RoomEvent.Reconnected, handleReconnected);
        
        // Note: LiveKitのengine構造が変更されたため、WebSocketエラーイベントの監視は省略
      };
    }

    return () => {
      // React 19のref cleanup機能を活用したクリーンアップ
      const currentCleanup = roomEventListenersRef.current.cleanup;
      if (currentCleanup) {
        currentCleanup();
        roomEventListenersRef.current.cleanup = null;
      }
    };
  }, [room, setOptimisticConnectionState]);

  // Update stream stats periodically
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(updateStreamStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isConnected, updateStreamStats]);

  // Initialize media on component mount
  useEffect(() => {
    let isMounted = true;

    const initializeMediaOnMount = async () => {
      if (isInitializingMedia || isMediaInitialized) return;

      setIsInitializingMedia(true);
      try {
        await initializeMedia();
        if (isMounted) {
          console.log("Media initialized automatically on component mount");
        }
      } catch (error) {
        console.error("Failed to initialize media on mount:", error);
        // Don't set error state here, let user manually trigger via button
        if (isMounted) {
          setIsMediaInitialized(false);
        }
      } finally {
        if (isMounted) {
          setIsInitializingMedia(false);
        }
      }
    };

    // Small delay to ensure component is fully mounted
    const timer = setTimeout(initializeMediaOnMount, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [initializeMedia, isInitializingMedia, isMediaInitialized]);

  // Get camera connection ID from session storage
  useEffect(() => {
    const storedConnectionId = sessionStorage.getItem(
      "harecame_camera_connection_id"
    );
    if (storedConnectionId) {
      setCameraConnectionId(storedConnectionId);
    }
  }, []);

  // Monitor connection state changes and update camera status
  useEffect(() => {
    if (!cameraConnectionId) return;

    if (isConnected) {
      updateCameraStatus("active");
    } else {
      updateCameraStatus("inactive");
    }
  }, [isConnected, cameraConnectionId, updateCameraStatus]);

  // React 19のref cleanup機能を活用したリソース管理の最適化
  const resourceCleanupRef = useRef<{
    mediaCleanup: (() => void) | null;
    roomCleanup: (() => void) | null;
  }>({ mediaCleanup: null, roomCleanup: null });

  // Cleanup on unmount with improved resource management
  const cleanupResources = useCallback(() => {
    console.log("Component unmounting, cleaning up resources");

    // メディアトラックの停止（React 19のref cleanup機能を活用）
    if (localVideoTrack.current) {
      console.log("Stopping local video track");
      localVideoTrack.current.stop();
      localVideoTrack.current = null;
    }
    if (localAudioTrack.current) {
      console.log("Stopping local audio track");
      localAudioTrack.current.stop();
      localAudioTrack.current = null;
    }

    // ビデオ要素のクリア（React 19のref cleanup機能で自動処理される）
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Room接続のクリーンアップ
    if (room && room.state !== ConnectionState.Disconnected) {
      console.log("Disconnecting room during cleanup");
      room.disconnect().catch((error) => {
        console.error("Error during cleanup disconnect:", error);
      });
    }

    // イベントリスナーのクリーンアップ
    if (roomEventListenersRef.current.cleanup) {
      roomEventListenersRef.current.cleanup();
      roomEventListenersRef.current.cleanup = null;
    }

    // リソース監視のクリーンアップ
    const cleanup = (
      window as unknown as {
        harecameCleanup?: { connection: () => void; stream: () => void };
      }
    ).harecameCleanup;
    if (cleanup) {
      cleanup.connection();
      cleanup.stream();
      delete (window as unknown as { harecameCleanup?: unknown })
        .harecameCleanup;
    }

    // カスタムクリーンアップ関数の実行
    if (resourceCleanupRef.current.mediaCleanup) {
      resourceCleanupRef.current.mediaCleanup();
      resourceCleanupRef.current.mediaCleanup = null;
    }
    if (resourceCleanupRef.current.roomCleanup) {
      resourceCleanupRef.current.roomCleanup();
      resourceCleanupRef.current.roomCleanup = null;
    }
  }, [room]);

  // React 19のref cleanup機能を活用したアンマウント時のクリーンアップ
  useEffect(() => {
    // リソース監視の設定
    const setupResourceMonitoring = () => {
      // メモリリークを防ぐためのリソース監視
      const mediaCleanup = () => {
        console.log("Media resource cleanup triggered");
        if (localVideoTrack.current) {
          localVideoTrack.current.stop();
        }
        if (localAudioTrack.current) {
          localAudioTrack.current.stop();
        }
      };

      const roomCleanup = () => {
        console.log("Room resource cleanup triggered");
        if (room && room.state !== ConnectionState.Disconnected) {
          room.disconnect().catch(console.error);
        }
      };

      resourceCleanupRef.current = { mediaCleanup, roomCleanup };

      // グローバルクリーンアップ関数の設定（デバッグ用）
      (window as unknown as { harecameCleanup?: unknown }).harecameCleanup = {
        connection: roomCleanup,
        stream: mediaCleanup,
      };
    };

    setupResourceMonitoring();

    // React 19のref cleanup機能を活用したクリーンアップ
    return cleanupResources;
  }, [cleanupResources, room]);

  // カメラ権限エラーの場合は専用コンポーネントを表示
  if (
    mediaError &&
    ["NotAllowedError", "NotFoundError", "NotReadableError"].includes(
      mediaError.name
    )
  ) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <CameraPermissionError
          error={mediaError}
          onRetry={() => {
            setMediaError(null);
            setError(null);
            initializeMedia().catch(console.error);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Video className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="truncate">{eventTitle}</span>
          </CardTitle>
          <CardDescription className="text-sm">
            {participantName
              ? `${participantName}として参加中`
              : "カメラオペレーターとして参加中"}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Video Preview */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">
            カメラプレビュー
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden touch-manipulation">
            <video
              ref={videoRefCallback}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{
                // モバイルでのビデオ最適化
                WebkitTransform: "translateZ(0)",
                transform: "translateZ(0)",
              }}
              onLoadStart={() => {
                console.log("Video load started");
                setIsVideoPlaying(false);
              }}
              onLoadedData={() => {
                console.log("Video data loaded");
                setIsVideoPlaying(true);
              }}
              onCanPlay={() => {
                console.log("Video can play");
                setIsVideoPlaying(true);
              }}
              onPlaying={() => {
                console.log("Video is playing");
                setIsVideoPlaying(true);
              }}
              onLoadedMetadata={() => {
                console.log("Video metadata loaded");
                setIsVideoPlaying(true);
              }}
              onError={(e) => {
                console.error("Video error:", e);
                setIsVideoPlaying(false);
              }}
            />

            {/* カメラ初期化中のローディング表示 */}
            {!isVideoPlaying &&
              !mediaError &&
              !isMediaInitialized &&
              !isDisconnected && (
                <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center text-white">
                  <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 animate-spin mb-2" />
                  <p className="text-sm sm:text-base">カメラを準備中...</p>
                </div>
              )}

            {/* 切断後の表示 */}
            {isDisconnected && !isVideoPlaying && (
              <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center text-white">
                <PhoneOff className="h-8 w-8 sm:h-12 sm:w-12 mb-2 text-gray-400" />
                <p className="text-sm sm:text-base text-gray-300">
                  配信を終了しました
                </p>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  再度配信するには下のボタンを押してください
                </p>
              </div>
            )}

            {!isVideoEnabled && isMediaInitialized && (
              <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <VideoOff className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
              </div>
            )}

            {/* Status Overlay - モバイル最適化（楽観的状態を使用） */}
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col sm:flex-row gap-1 sm:gap-2">
              <Badge
                variant={optimisticConnectionState.isConnected ? "default" : "secondary"}
                className="flex items-center gap-1 text-xs sm:text-sm px-2 py-1"
              >
                {optimisticConnectionState.isConnected ? (
                  <Wifi className="h-2 w-2 sm:h-3 sm:w-3" />
                ) : (
                  <WifiOff className="h-2 w-2 sm:h-3 sm:w-3" />
                )}
                <span className="hidden sm:inline">
                  {optimisticConnectionState.isConnected ? "ライブ配信中" : 
                   optimisticConnectionState.isConnecting ? "接続中..." : "未接続"}
                </span>
                <span className="sm:hidden">
                  {optimisticConnectionState.isConnected ? "LIVE" : 
                   optimisticConnectionState.isConnecting ? "..." : "OFF"}
                </span>
              </Badge>

              {optimisticConnectionState.isConnected && (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 text-xs sm:text-sm px-2 py-1"
                >
                  {getConnectionQualityIcon()}
                  <span className="hidden sm:inline">
                    {getConnectionQualityText()}
                  </span>
                </Badge>
              )}
            </div>

            {/* デバイス向き案内（モバイルのみ） */}
            <div className="absolute bottom-2 right-2 sm:hidden">
              <div className="bg-black/70 text-white text-xs px-2 py-1 rounded">
                {deviceOrientation.orientation === "portrait"
                  ? "📱 横向き推奨"
                  : "📹 配信中"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">接続状況</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">接続品質</span>
                <div className="flex items-center gap-2">
                  {getConnectionQualityIcon()}
                  <span className="text-sm">{getConnectionQualityText()}</span>
                </div>
              </div>
              <Progress
                value={getConnectionQualityPercentage()}
                className="h-2"
              />
            </div>

            {streamStats && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">解像度:</span>
                  <div className="font-medium">{streamStats.resolution}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">フレームレート:</span>
                  <div className="font-medium">{streamStats.frameRate} fps</div>
                </div>
                <div>
                  <span className="text-muted-foreground">ビットレート:</span>
                  <div className="font-medium">
                    {Math.round(streamStats.bitrate / 1000)} kbps
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">コーデック:</span>
                  <div className="font-medium">{streamStats.codec}</div>
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">ネットワーク:</span>
                  <div className="font-medium">
                    {networkQuality.effectiveType.toUpperCase()}
                    {networkQuality.downlink > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({networkQuality.downlink}Mbps)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Media Permission Error with Retry */}
      {mediaError && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              カメラ・マイクのアクセス権限が必要です
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-600">
              {mediaError.name === "NotAllowedError" && (
                <div className="space-y-2">
                  <p>ブラウザでカメラとマイクの使用が拒否されました。</p>
                  <p>以下の手順で権限を許可してください：</p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>ブラウザのアドレスバー左側のアイコンをクリック</li>
                    <li>「カメラ」と「マイク」を「許可」に変更</li>
                    <li>
                      ページを再読み込み、または下のボタンを押してください
                    </li>
                  </ol>
                </div>
              )}
              {mediaError.name === "NotFoundError" && (
                <p>
                  カメラまたはマイクが見つかりません。デバイスが正しく接続されているか確認してください。
                </p>
              )}
              {mediaError.name === "NotReadableError" && (
                <p>
                  カメラまたはマイクが他のアプリケーションで使用されています。他のアプリを閉じてから再試行してください。
                </p>
              )}
            </div>
            <Button
              onClick={async () => {
                setError(null);
                setMediaError(null);
                setIsMediaInitialized(false);
                try {
                  await initializeMedia();
                } catch (err) {
                  console.error("Retry failed:", err);
                }
              }}
              className="w-full"
              disabled={isInitializingMedia}
            >
              {isInitializingMedia ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  権限を再確認中...
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  カメラ・マイクの権限を再試行
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Controls - タッチ最適化 */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
            {!isMediaInitialized ? (
              <Button
                onClick={async () => {
                  setError(null);
                  setMediaError(null);
                  try {
                    await initializeMedia();
                  } catch (err) {
                    console.error("Manual media initialization failed:", err);
                  }
                }}
                disabled={isInitializingMedia}
                size="lg"
                className="flex-1 max-w-xs min-h-[48px] touch-manipulation"
              >
                {isInitializingMedia ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">準備中...</span>
                    <span className="sm:hidden">準備中</span>
                  </>
                ) : (
                  <>
                    <Video className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">カメラを開始</span>
                    <span className="sm:hidden">カメラ開始</span>
                  </>
                )}
              </Button>
            ) : !optimisticConnectionState.isConnected ? (
              <Button
                onClick={connectToRoom}
                disabled={optimisticConnectionState.isConnecting}
                size="lg"
                className="flex-1 max-w-xs min-h-[48px] touch-manipulation"
              >
                {optimisticConnectionState.isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">接続中...</span>
                    <span className="sm:hidden">接続中</span>
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">配信開始</span>
                    <span className="sm:hidden">開始</span>
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  onClick={toggleVideo}
                  variant={isVideoEnabled ? "default" : "secondary"}
                  size="lg"
                  className="min-h-[48px] min-w-[48px] touch-manipulation"
                  aria-label={
                    isVideoEnabled ? "カメラをオフにする" : "カメラをオンにする"
                  }
                >
                  {isVideoEnabled ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <VideoOff className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  onClick={toggleAudio}
                  variant={isAudioEnabled ? "default" : "secondary"}
                  size="lg"
                  className="min-h-[48px] min-w-[48px] touch-manipulation"
                  aria-label={
                    isAudioEnabled ? "マイクをオフにする" : "マイクをオンにする"
                  }
                >
                  {isAudioEnabled ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <MicOff className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  onClick={disconnectFromRoom}
                  variant="destructive"
                  size="lg"
                  className="min-h-[48px] touch-manipulation"
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">配信終了</span>
                  <span className="sm:hidden">終了</span>
                </Button>
              </>
            )}
          </div>

          {/* モバイル用の説明テキスト */}
          {optimisticConnectionState.isConnected && (
            <div className="mt-4 text-center text-xs text-muted-foreground sm:hidden">
              <p>タップしてカメラ・マイクを切り替え</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      {!optimisticConnectionState.isConnected && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">配信を開始する前に</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• カメラとマイクの使用を許可してください</p>
                <p>• 安定したインターネット接続を確保してください</p>
                <p>• スマートフォンを横向きにすると画質が向上します</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
