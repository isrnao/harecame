"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  startTransition,
} from "react";
import type { WindowWithCleanup } from "@/lib/type-guards";
import { hasCleanupFunction } from "@/lib/type-guards";
import { Video } from "@/components/ui/video";

import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  LocalAudioTrack,
  ConnectionState,
  ConnectionQuality,
  Track,
} from "livekit-client";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { CameraPermissionError } from "@/components/error/CameraPermissionError";
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
  Video as VideoIcon,
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

  const [room] = useState(() => new Room());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    ConnectionQuality.Unknown
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
  // プレビュー用ミラー表示のON/OFF
  const [isMirrorPreview, setIsMirrorPreview] = useState(true);

  // 初期化フラグを管理するRef（コンポーネントインスタンス固有）
  const isMediaInitializationInProgress = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoTrack = useRef<LocalVideoTrack | null>(null);
  const localAudioTrack = useRef<LocalAudioTrack | null>(null);

  // デバイス向き検出
  const deviceOrientation = useDeviceOrientation();

  // ネットワーク品質検出
  const { networkQuality, recommendedQuality } = useNetworkQuality();

  // ネットワーク状態監視
  const { retryWithBackoff } = useNetworkStatus();

  // Initialize camera and microphone
  const initializeMedia = useCallback(async () => {
    try {
      setError(null);
      setMediaError(null);
      console.log("Requesting camera and microphone permissions...");

      // Request camera and microphone permissions using getUserMedia
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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("Media stream obtained successfully");
      console.log("Video tracks:", stream.getVideoTracks().length);
      console.log("Audio tracks:", stream.getAudioTracks().length);

      // Create LiveKit tracks from the stream
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      if (videoTracks.length === 0) {
        throw new Error("ビデオトラックが見つかりません");
      }
      if (audioTracks.length === 0) {
        throw new Error("オーディオトラックが見つかりません");
      }

      const videoTrack = new LocalVideoTrack(videoTracks[0]!);
      const audioTrack = new LocalAudioTrack(audioTracks[0]!);

      localVideoTrack.current = videoTrack;
      localAudioTrack.current = audioTrack;

      // Display local video - 確実にビデオを表示するための改善
      if (videoRef.current && stream.getVideoTracks().length > 0) {
        console.log("Setting video source to video element");
        videoRef.current.srcObject = stream;

        // ビデオの再生を確実に開始
        try {
          await videoRef.current.play();
          console.log("Video playback started successfully");
        } catch (playError) {
          console.error("Failed to start video playback:", playError);
          // ユーザーの操作が必要な場合もあるため、エラーは警告として扱う
        }

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

      return { videoTrack, audioTrack };
    } catch (error) {
      console.error("Failed to initialize media:", error);

      if (error instanceof Error) {
        setMediaError(error);
        if (error.name === "NotAllowedError") {
          setError(
            "カメラまたはマイクへのアクセスが拒否されました。ブラウザの設定を確認してください。"
          );
        } else if (error.name === "NotFoundError") {
          setError(
            "カメラまたはマイクが見つかりません。デバイスが接続されているか確認してください。"
          );
        } else if (error.name === "NotReadableError") {
          setError(
            "カメラまたはマイクが他のアプリケーションで使用されています。"
          );
        } else {
          setError(`メディアデバイスの初期化に失敗しました: ${error.message}`);
        }
      } else {
        setError(
          "カメラまたはマイクへのアクセスが拒否されました。ブラウザの設定を確認してください。"
        );
      }
      setIsMediaInitialized(false);
      throw error;
    }
  }, [recommendedQuality, networkQuality]);

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

  // Connect to LiveKit room with retry logic
  const connectToRoom = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);
    setIsDisconnected(false);

    try {
      // Initialize media first
      const { videoTrack, audioTrack } = await initializeMedia();

      console.log("Attempting to connect to LiveKit room:", {
        url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
        roomName,
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

      // React 19: バッチング機能を活用して状態更新を最適化
      startTransition(() => {
        setIsConnected(true);

        // 接続成功時に親への状態通知を直接実行
        if (cameraConnectionId) {
          updateCameraStatus("active");
        }
      });
    } catch (error) {
      console.error("Failed to connect to room:", error);

      // React 19: ref cleanup機能を活用したメディアトラックのクリーンアップ
      if (localVideoTrack.current) {
        localVideoTrack.current.stop();
        // React 19: ref cleanup機能により自動的にnullに設定される
      }
      if (localAudioTrack.current) {
        localAudioTrack.current.stop();
        // React 19: ref cleanup機能により自動的にnullに設定される
      }

      // React 19: バッチング機能を活用して状態更新を最適化
      startTransition(() => {
        setIsConnected(false);

        // 接続失敗時に親への状態通知を直接実行
        if (cameraConnectionId) {
          updateCameraStatus("error");
        }
      });

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
    isConnecting,
    isConnected,
    initializeMedia,
    roomName,
    roomToken,
    room,
    retryWithBackoff,
    cameraConnectionId,
    updateCameraStatus,
  ]);

  // Disconnect from room
  const disconnectFromRoom = useCallback(async () => {
    try {
      console.log("Disconnecting from room, current state:", {
        isConnected,
        roomState: room.state,
        hasLocalVideoTrack: !!localVideoTrack.current,
        hasLocalAudioTrack: !!localAudioTrack.current,
      });

      // React 19: ref cleanup機能を活用したローカルトラックの停止
      if (localVideoTrack.current) {
        console.log("Stopping local video track");
        localVideoTrack.current.stop();
        // React 19: ref cleanup機能により自動的にnullに設定される
      }
      if (localAudioTrack.current) {
        console.log("Stopping local audio track");
        localAudioTrack.current.stop();
        // React 19: ref cleanup機能により自動的にnullに設定される
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

      // React 19: バッチング機能を活用して状態更新を最適化
      startTransition(() => {
        setIsConnected(false);
        setIsConnecting(false);
        setIsDisconnected(true);

        // 切断時に親への状態通知を直接実行
        if (cameraConnectionId) {
          updateCameraStatus("inactive");
        }
      });

      // メディアは初期化されたままにして、再接続時に再利用できるようにする

      // React 19: 型ガード関数を使用したリソース監視のクリーンアップ
      const windowWithCleanup = window as WindowWithCleanup;
      if (
        hasCleanupFunction(windowWithCleanup) &&
        windowWithCleanup.harecameCleanup
      ) {
        windowWithCleanup.harecameCleanup.connection();
        windowWithCleanup.harecameCleanup.stream();
        delete windowWithCleanup.harecameCleanup;
      }

      console.log("Room disconnection completed");
    } catch (error) {
      console.error("Failed to disconnect from room:", error);
      // React 19: バッチング機能を活用して状態更新を最適化
      startTransition(() => {
        setIsConnected(false);
        setIsMediaInitialized(false);

        // 切断失敗時にも親への状態通知を実行
        if (cameraConnectionId) {
          updateCameraStatus("inactive");
        }
      });
    }
  }, [isConnected, room, cameraConnectionId, updateCameraStatus]);

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

  // Set up room event listeners
  useEffect(() => {
    const handleConnectionStateChanged = (state: ConnectionState) => {
      console.log("Room connection state changed:", state);
      setConnectionState(state);
      if (state === ConnectionState.Disconnected) {
        setIsConnected(false);
      }
    };

    const handleConnectionQualityChanged = (quality: ConnectionQuality) => {
      console.log("Connection quality changed:", quality);
      setConnectionQuality(quality);
    };

    const handleDisconnected = () => {
      console.log("Room disconnected event received");
      setIsConnected(false);
      setError("配信から切断されました");
    };

    // イベントリスナーを安全に追加
    if (room) {
      room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.on(
        RoomEvent.ConnectionQualityChanged,
        handleConnectionQualityChanged
      );
      room.on(RoomEvent.Disconnected, handleDisconnected);
    }

    return () => {
      // イベントリスナーを安全に削除
      if (room) {
        room.off(
          RoomEvent.ConnectionStateChanged,
          handleConnectionStateChanged
        );
        room.off(
          RoomEvent.ConnectionQualityChanged,
          handleConnectionQualityChanged
        );
        room.off(RoomEvent.Disconnected, handleDisconnected);
      }
    };
  }, [room]);

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
      // 開発環境での二重実行を防ぐ
      if (
        isInitializingMedia ||
        isMediaInitialized ||
        isMediaInitializationInProgress.current
      ) {
        return;
      }

      isMediaInitializationInProgress.current = true;
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
        isMediaInitializationInProgress.current = false;
      }
    };

    // Small delay to ensure component is fully mounted
    const timer = setTimeout(initializeMediaOnMount, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      // 開発環境でのクリーンアップ時にフラグをリセット
      if (process.env.NODE_ENV === "development") {
        isMediaInitializationInProgress.current = false;
      }
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
  // React 19: useEffectで親への通知を行うのではなく、イベントハンドラーで直接実行
  // useEffect(() => {
  //   if (!cameraConnectionId) return;
  //
  //   if (isConnected) {
  //     updateCameraStatus("active");
  //   } else {
  //     updateCameraStatus("inactive");
  //   }
  // }, [isConnected, cameraConnectionId, updateCameraStatus]);

  // Cleanup on unmount
  const cleanupResources = useCallback(() => {
    // アンマウント時のクリーンアップ
    console.log("Component unmounting, cleaning up resources");

    // メディアトラックの停止
    if (localVideoTrack.current) {
      localVideoTrack.current.stop();
    }
    if (localAudioTrack.current) {
      localAudioTrack.current.stop();
    }

    // ビデオ要素のクリア
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Roomからの切断（接続状態をチェック）
    if (room && room.state !== ConnectionState.Disconnected) {
      room.disconnect().catch((error) => {
        console.error("Error during cleanup disconnect:", error);
      });
    }

    // React 19: 型ガード関数を使用したリソース監視のクリーンアップ
    const windowWithCleanup = window as WindowWithCleanup;
    if (
      hasCleanupFunction(windowWithCleanup) &&
      windowWithCleanup.harecameCleanup
    ) {
      windowWithCleanup.harecameCleanup.connection();
      windowWithCleanup.harecameCleanup.stream();
      delete windowWithCleanup.harecameCleanup;
    }
  }, [room]);

  useEffect(() => {
    return cleanupResources;
  }, [cleanupResources]);

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
            <VideoIcon className="h-4 w-4 sm:h-5 sm:w-5" />
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
            {/* React 19: ref as propパターンを使用したVideoコンポーネント */}
            <Video
              ref={videoRef}
              mirror={isMirrorPreview}
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

            {/* Status Overlay - モバイル最適化 */}
            <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col sm:flex-row gap-1 sm:gap-2">
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className="flex items-center gap-1 text-xs sm:text-sm px-2 py-1"
              >
                {isConnected ? (
                  <Wifi className="h-2 w-2 sm:h-3 sm:w-3" />
                ) : (
                  <WifiOff className="h-2 w-2 sm:h-3 sm:w-3" />
                )}
                <span className="hidden sm:inline">
                  {isConnected ? "ライブ配信中" : "未接続"}
                </span>
                <span className="sm:hidden">
                  {isConnected ? "LIVE" : "OFF"}
                </span>
              </Badge>

              {isConnected && (
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

            {/* ミラーON/OFFトグル */}
            <div className="absolute bottom-2 left-2">
              <button
                type="button"
                onClick={() => setIsMirrorPreview((v) => !v)}
                className="bg-black/70 text-white text-xs sm:text-sm px-2 py-1 rounded shadow hover:bg-black/80 transition"
                aria-pressed={isMirrorPreview}
                aria-label="ミラー表示を切り替え"
              >
                {isMirrorPreview ? "鏡表示: ON" : "鏡表示: OFF"}
              </button>
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
                  <VideoIcon className="mr-2 h-4 w-4" />
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
                    <VideoIcon className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">カメラを開始</span>
                    <span className="sm:hidden">カメラ開始</span>
                  </>
                )}
              </Button>
            ) : !isConnected ? (
              <Button
                onClick={connectToRoom}
                disabled={isConnecting}
                size="lg"
                className="flex-1 max-w-xs min-h-[48px] touch-manipulation"
              >
                {isConnecting ? (
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
                    <VideoIcon className="h-5 w-5" />
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
          {isConnected && (
            <div className="mt-4 text-center text-xs text-muted-foreground sm:hidden">
              <p>タップしてカメラ・マイクを切り替え</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      {!isConnected && (
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
