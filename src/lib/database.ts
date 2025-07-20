// Database CRUD operations for Harecame application
import { supabase, supabaseAdmin } from './supabase';
import type { 
  Event, 
  CameraConnection, 
  StreamStatus, 
  EventLog,
  EventClient,
  CameraConnectionClient,
  StreamStatusClient
} from '@/types';

// Utility functions to convert between database and client formats
export function dbEventToClient(event: Event): EventClient {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    scheduledAt: event.scheduled_at,
    status: event.status,
    participationCode: event.participation_code,
    youtubeStreamUrl: event.youtube_stream_url,
    youtubeStreamKey: event.youtube_stream_key,
    youtubeVideoId: event.youtube_video_id,
    livekitRoomName: event.livekit_room_name,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

export function clientEventToDb(event: Partial<EventClient>): Partial<Event> {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    scheduled_at: event.scheduledAt,
    status: event.status,
    participation_code: event.participationCode,
    youtube_stream_url: event.youtubeStreamUrl,
    youtube_stream_key: event.youtubeStreamKey,
    youtube_video_id: event.youtubeVideoId,
    livekit_room_name: event.livekitRoomName,
  };
}

export function dbCameraToClient(camera: CameraConnection): CameraConnectionClient {
  return {
    id: camera.id,
    eventId: camera.event_id,
    participantId: camera.participant_id,
    participantName: camera.participant_name,
    deviceInfo: camera.device_info,
    streamQuality: camera.stream_quality,
    status: camera.status,
    joinedAt: camera.joined_at,
    lastActiveAt: camera.last_active_at,
    disconnectedAt: camera.disconnected_at,
  };
}

export function dbStreamStatusToClient(status: StreamStatus): StreamStatusClient {
  return {
    id: status.id,
    eventId: status.event_id,
    isLive: status.is_live,
    activeCameraCount: status.active_camera_count,
    currentActiveCamera: status.current_active_camera,
    youtubeViewerCount: status.youtube_viewer_count,
    streamHealth: status.stream_health,
    lastSwitchAt: status.last_switch_at,
    updatedAt: status.updated_at,
  };
}

// Event CRUD operations
export class EventService {
  // Create a new event
  static async create(eventData: {
    title: string;
    description?: string;
    scheduledAt?: Date;
  }): Promise<EventClient> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    // Generate unique participation code
    const participationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const livekitRoomName = `event_${Date.now()}_${participationCode}`;

    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        title: eventData.title,
        description: eventData.description,
        scheduled_at: eventData.scheduledAt,
        participation_code: participationCode,
        livekit_room_name: livekitRoomName,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create event: ${error.message}`);
    }

    return dbEventToClient(data);
  }

  // Get event by ID
  static async getById(id: string): Promise<EventClient | null> {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get event: ${error.message}`);
    }

    return dbEventToClient(data);
  }

  // Get event by participation code
  static async getByParticipationCode(code: string): Promise<EventClient | null> {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('participation_code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get event by participation code: ${error.message}`);
    }

    return dbEventToClient(data);
  }

  // Update event
  static async update(id: string, updates: Partial<EventClient>): Promise<EventClient> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    const dbUpdates = clientEventToDb(updates);
    
    const { data, error } = await supabaseAdmin
      .from('events')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update event: ${error.message}`);
    }

    return dbEventToClient(data);
  }

  // Delete event
  static async delete(id: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    const { error } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete event: ${error.message}`);
    }
  }

  // List events with pagination
  static async list(options: {
    limit?: number;
    offset?: number;
    status?: Event['status'];
  } = {}): Promise<EventClient[]> {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }

    let query = supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list events: ${error.message}`);
    }

    return data.map(dbEventToClient);
  }
}

// Camera Connection CRUD operations
export class CameraConnectionService {
  // Create a new camera connection
  static async create(connectionData: {
    eventId: string;
    participantId: string;
    participantName?: string;
    deviceInfo?: CameraConnectionClient['deviceInfo'];
  }): Promise<CameraConnectionClient> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('camera_connections')
      .insert({
        event_id: connectionData.eventId,
        participant_id: connectionData.participantId,
        participant_name: connectionData.participantName,
        device_info: connectionData.deviceInfo || {},
        stream_quality: {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create camera connection: ${error.message}`);
    }

    return dbCameraToClient(data);
  }

  // Get camera connection by ID
  static async getById(id: string): Promise<CameraConnectionClient | null> {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }

    const { data, error } = await supabase
      .from('camera_connections')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get camera connection: ${error.message}`);
    }

    return dbCameraToClient(data);
  }

  // Get camera connections for an event
  static async getByEventId(eventId: string): Promise<CameraConnectionClient[]> {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }

    const { data, error } = await supabase
      .from('camera_connections')
      .select('*')
      .eq('event_id', eventId)
      .order('joined_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get camera connections: ${error.message}`);
    }

    return data.map(dbCameraToClient);
  }

  // Update camera connection status
  static async updateStatus(
    id: string, 
    status: CameraConnection['status'],
    streamQuality?: CameraConnectionClient['streamQuality']
  ): Promise<CameraConnectionClient> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    const updates: Partial<CameraConnection> = {
      status,
      last_active_at: new Date(),
    };

    if (streamQuality) {
      updates.stream_quality = streamQuality;
    }

    if (status === 'inactive' || status === 'error') {
      updates.disconnected_at = new Date();
    }

    const { data, error } = await supabaseAdmin
      .from('camera_connections')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update camera connection: ${error.message}`);
    }

    return dbCameraToClient(data);
  }

  // Delete camera connection
  static async delete(id: string): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    const { error } = await supabaseAdmin
      .from('camera_connections')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete camera connection: ${error.message}`);
    }
  }
}

// Stream Status CRUD operations
export class StreamStatusService {
  // Create or update stream status
  static async upsert(statusData: {
    eventId: string;
    isLive?: boolean;
    activeCameraCount?: number;
    currentActiveCamera?: string;
    youtubeViewerCount?: number;
    streamHealth?: StreamStatus['stream_health'];
  }): Promise<StreamStatusClient> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('stream_status')
      .upsert({
        event_id: statusData.eventId,
        is_live: statusData.isLive ?? false,
        active_camera_count: statusData.activeCameraCount ?? 0,
        current_active_camera: statusData.currentActiveCamera,
        youtube_viewer_count: statusData.youtubeViewerCount ?? 0,
        stream_health: statusData.streamHealth ?? 'unknown',
        updated_at: new Date(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert stream status: ${error.message}`);
    }

    return dbStreamStatusToClient(data);
  }

  // Get stream status by event ID
  static async getByEventId(eventId: string): Promise<StreamStatusClient | null> {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }

    const { data, error } = await supabase
      .from('stream_status')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get stream status: ${error.message}`);
    }

    return dbStreamStatusToClient(data);
  }
}

// Event Log operations
export class EventLogService {
  // Create a new log entry
  static async create(logData: {
    eventId: string;
    cameraConnectionId?: string;
    logType: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!supabaseAdmin) {
      console.warn('Supabase admin client not configured - skipping log creation');
      return;
    }

    const { error } = await supabaseAdmin
      .from('event_logs')
      .insert({
        event_id: logData.eventId,
        camera_connection_id: logData.cameraConnectionId,
        log_type: logData.logType,
        message: logData.message,
        metadata: logData.metadata || {},
      });

    if (error) {
      console.error('Failed to create event log:', error.message);
      // Don't throw error for logging failures to avoid breaking main functionality
    }
  }

  // Get logs for an event
  static async getByEventId(eventId: string, limit = 100): Promise<EventLog[]> {
    if (!supabase) {
      throw new Error('Supabase client not configured');
    }

    const { data, error } = await supabase
      .from('event_logs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get event logs: ${error.message}`);
    }

    return data;
  }
}