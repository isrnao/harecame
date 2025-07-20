// Core type definitions for Harecame application

// Database table interfaces (matching Supabase schema)
export interface Event {
  id: string;
  title: string;
  description?: string;
  scheduled_at?: Date;
  status: 'scheduled' | 'live' | 'ended';
  participation_code: string;
  youtube_stream_url?: string;
  youtube_stream_key?: string;
  youtube_video_id?: string;
  livekit_room_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface CameraConnection {
  id: string;
  event_id: string;
  participant_id: string;
  participant_name?: string;
  device_info: {
    userAgent?: string;
    screenResolution?: string;
    connectionType?: string;
    platform?: string;
    browser?: string;
  };
  stream_quality: {
    resolution?: string;
    frameRate?: number;
    bitrate?: number;
    codec?: string;
  };
  status: 'connecting' | 'active' | 'inactive' | 'error';
  joined_at: Date;
  last_active_at: Date;
  disconnected_at?: Date;
}

export interface StreamStatus {
  id: string;
  event_id: string;
  is_live: boolean;
  active_camera_count: number;
  current_active_camera?: string;
  youtube_viewer_count: number;
  stream_health: 'excellent' | 'good' | 'poor' | 'critical' | 'unknown';
  last_switch_at?: Date;
  updated_at: Date;
}

export interface EventLog {
  id: string;
  event_id: string;
  camera_connection_id?: string;
  log_type: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// Client-side interfaces (camelCase for frontend use)
export interface EventClient {
  id: string;
  title: string;
  description?: string;
  scheduledAt?: Date;
  status: 'scheduled' | 'live' | 'ended';
  participationCode: string;
  youtubeStreamUrl?: string;
  youtubeStreamKey?: string;
  youtubeVideoId?: string;
  livekitRoomName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CameraConnectionClient {
  id: string;
  eventId: string;
  participantId: string;
  participantName?: string;
  deviceInfo: {
    userAgent?: string;
    screenResolution?: string;
    connectionType?: string;
    platform?: string;
    browser?: string;
  };
  streamQuality: {
    resolution?: string;
    frameRate?: number;
    bitrate?: number;
    codec?: string;
  };
  status: 'connecting' | 'active' | 'inactive' | 'error';
  joinedAt: Date;
  lastActiveAt: Date;
  disconnectedAt?: Date;
}

export interface StreamStatusClient {
  id: string;
  eventId: string;
  isLive: boolean;
  activeCameraCount: number;
  currentActiveCamera?: string;
  youtubeViewerCount: number;
  streamHealth: 'excellent' | 'good' | 'poor' | 'critical' | 'unknown';
  lastSwitchAt?: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form types for React 19 Actions
export interface EventCreationFormData {
  title: string;
  description?: string;
  scheduledAt?: Date;
}

export interface CameraJoinFormData {
  participationCode: string;
  deviceInfo?: {
    userAgent: string;
    screenResolution: string;
    connectionType: string;
  };
}

// LiveKit related types
export interface LiveKitParticipant {
  identity: string;
  name?: string;
  metadata?: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
}

// YouTube related types
export interface YouTubeStreamInfo {
  videoId: string;
  embedUrl: string;
  watchUrl: string;
  chatId?: string;
  viewerCount: number;
  isLive: boolean;
}