// WebSocket event handling for real-time features
import {
  EventLogService,
  CameraConnectionService,
  StreamStatusService,
} from "./database";

// WebSocket event types
export interface WebSocketEvent {
  type: string;
  eventId: string;
  participantId?: string;
  cameraConnectionId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

// Camera connection events
export interface CameraJoinedEvent extends WebSocketEvent {
  type: "camera-joined";
  participantId: string;
  cameraConnectionId: string;
  data: {
    participantName?: string;
    deviceInfo: Record<string, unknown>;
  };
}

export interface CameraStartedStreamingEvent extends WebSocketEvent {
  type: "camera-started-streaming";
  participantId: string;
  cameraConnectionId: string;
  data: {
    streamQuality: {
      resolution: string;
      frameRate: number;
      bitrate: number;
      codec: string;
    };
  };
}

export interface CameraDisconnectedEvent extends WebSocketEvent {
  type: "camera-disconnected";
  participantId: string;
  cameraConnectionId: string;
  data: {
    reason: string;
    duration: number; // Connection duration in seconds
  };
}

export interface StreamSwitchedEvent extends WebSocketEvent {
  type: "stream-switched";
  data: {
    fromCamera?: string;
    toCamera: string;
    reason: "new-camera" | "camera-disconnected" | "manual-switch";
  };
}

// Event handlers
export class WebSocketEventHandler {
  // Handle camera joined event
  static async handleCameraJoined(event: CameraJoinedEvent): Promise<void> {
    try {
      console.log("Camera joined:", event);

      // Log the event
      await EventLogService.create({
        eventId: event.eventId,
        cameraConnectionId: event.cameraConnectionId,
        logType: "camera_joined",
        message: `Camera ${event.participantId} joined the event`,
        metadata: {
          participantName: event.data.participantName,
          deviceInfo: event.data.deviceInfo,
        },
      });

      // Update stream status
      await this.updateStreamStatus(event.eventId);

      // Broadcast to other participants (if needed)
      await this.broadcastEvent(event);
    } catch (error) {
      console.error("Failed to handle camera joined event:", error);
    }
  }

  // Handle camera started streaming event
  static async handleCameraStartedStreaming(
    event: CameraStartedStreamingEvent
  ): Promise<void> {
    try {
      console.log("Camera started streaming:", event);

      // Update camera connection status
      await CameraConnectionService.updateStatus(
        event.cameraConnectionId,
        "active",
        event.data.streamQuality
      );

      // Log the event
      await EventLogService.create({
        eventId: event.eventId,
        cameraConnectionId: event.cameraConnectionId,
        logType: "camera_streaming_started",
        message: `Camera ${event.participantId} started streaming`,
        metadata: {
          streamQuality: event.data.streamQuality,
        },
      });

      // Implement "last-in priority" switching logic
      await this.handleStreamSwitching(event);

      // Update stream status
      await this.updateStreamStatus(event.eventId);

      // Broadcast to other participants
      await this.broadcastEvent(event);
    } catch (error) {
      console.error("Failed to handle camera started streaming event:", error);
    }
  }

  // Handle camera disconnected event
  static async handleCameraDisconnected(
    event: CameraDisconnectedEvent
  ): Promise<void> {
    try {
      console.log("Camera disconnected:", event);

      // Update camera connection status
      await CameraConnectionService.updateStatus(
        event.cameraConnectionId,
        "inactive"
      );

      // Log the event
      await EventLogService.create({
        eventId: event.eventId,
        cameraConnectionId: event.cameraConnectionId,
        logType: "camera_disconnected",
        message: `Camera ${event.participantId} disconnected`,
        metadata: {
          reason: event.data.reason,
          duration: event.data.duration,
        },
      });

      // Handle stream switching if this was the active camera
      await this.handleCameraDisconnection(event);

      // Update stream status
      await this.updateStreamStatus(event.eventId);

      // Broadcast to other participants
      await this.broadcastEvent(event);
    } catch (error) {
      console.error("Failed to handle camera disconnected event:", error);
    }
  }

  // Handle stream switching logic (last-in priority)
  private static async handleStreamSwitching(
    event: CameraStartedStreamingEvent
  ): Promise<void> {
    try {
      // Get current stream status
      const streamStatus = await StreamStatusService.getByEventId(
        event.eventId
      );

      // Always switch to the newest camera (last-in priority)
      const switchEvent: StreamSwitchedEvent = {
        type: "stream-switched",
        eventId: event.eventId,
        timestamp: Date.now(),
        data: {
          fromCamera: streamStatus?.currentActiveCamera,
          toCamera: event.cameraConnectionId,
          reason: "new-camera",
        },
      };

      // Update stream status with new active camera
      await StreamStatusService.upsert({
        eventId: event.eventId,
        currentActiveCamera: event.cameraConnectionId,
      });

      // Log the switch
      await EventLogService.create({
        eventId: event.eventId,
        cameraConnectionId: event.cameraConnectionId,
        logType: "stream_switched",
        message: `Stream switched to camera ${event.participantId}`,
        metadata: {
          fromCamera: switchEvent.data.fromCamera,
          toCamera: switchEvent.data.toCamera,
          reason: switchEvent.data.reason,
        },
      });

      // Broadcast switch event
      await this.broadcastEvent(switchEvent);
    } catch (error) {
      console.error("Failed to handle stream switching:", error);
    }
  }

  // Handle camera disconnection and failover
  private static async handleCameraDisconnection(
    event: CameraDisconnectedEvent
  ): Promise<void> {
    try {
      // Get current stream status
      const streamStatus = await StreamStatusService.getByEventId(
        event.eventId
      );

      // Check if the disconnected camera was the active one
      if (streamStatus?.currentActiveCamera === event.cameraConnectionId) {
        // Find another active camera to switch to
        const activeCameras = await CameraConnectionService.getByEventId(
          event.eventId
        );
        const otherActiveCameras = activeCameras.filter(
          (camera) =>
            camera.status === "active" && camera.id !== event.cameraConnectionId
        );

        if (otherActiveCameras.length > 0) {
          // Switch to the most recently joined active camera
          const newActiveCamera =
            otherActiveCameras.sort(
              (a, b) =>
                new Date(b.joinedAt).getTime() -
                new Date(a.joinedAt).getTime()
            )[0]!;

          

          const switchEvent: StreamSwitchedEvent = {
            type: "stream-switched",
            eventId: event.eventId,
            timestamp: Date.now(),
            data: {
              fromCamera: event.cameraConnectionId,
              toCamera: newActiveCamera.id,
              reason: "camera-disconnected",
            },
          };

          // Update stream status
          await StreamStatusService.upsert({
            eventId: event.eventId,
            currentActiveCamera: newActiveCamera.id,
          });

          // Log the switch
          await EventLogService.create({
            eventId: event.eventId,
            cameraConnectionId: newActiveCamera.id,
            logType: "stream_switched",
            message: `Stream switched to camera ${newActiveCamera.participantId} due to disconnection`,
            metadata: {
              fromCamera: switchEvent.data.fromCamera,
              toCamera: switchEvent.data.toCamera,
              reason: switchEvent.data.reason,
            },
          });

          // Broadcast switch event
          await this.broadcastEvent(switchEvent);
        } else {
          // No other active cameras - show standby screen
          await StreamStatusService.upsert({
            eventId: event.eventId,
            currentActiveCamera: undefined,
          });

          // Log standby state
          await EventLogService.create({
            eventId: event.eventId,
            logType: "stream_standby",
            message: "No active cameras - showing standby screen",
            metadata: {
              reason: "all_cameras_disconnected",
            },
          });
        }
      }
    } catch (error) {
      console.error("Failed to handle camera disconnection:", error);
    }
  }

  // Update stream status with current camera count
  private static async updateStreamStatus(eventId: string): Promise<void> {
    try {
      const cameras = await CameraConnectionService.getByEventId(eventId);
      const activeCameras = cameras.filter(
        (camera) => camera.status === "active"
      );

      await StreamStatusService.upsert({
        eventId,
        activeCameraCount: activeCameras.length,
        isLive: activeCameras.length > 0,
      });
    } catch (error) {
      console.error("Failed to update stream status:", error);
    }
  }

  // Broadcast event to connected clients (placeholder for WebSocket implementation)
  private static async broadcastEvent(event: WebSocketEvent): Promise<void> {
    try {
      // In a real implementation, this would broadcast to WebSocket clients
      // For now, we'll just log the event
      console.log("Broadcasting event:", event.type, event.eventId);

      // Store the event for Server-Sent Events (SSE) clients
      await this.storeEventForSSE(event);
    } catch (error) {
      console.error("Failed to broadcast event:", error);
    }
  }

  // Store event for Server-Sent Events clients
  private static async storeEventForSSE(event: WebSocketEvent): Promise<void> {
    try {
      // Store in a temporary cache for SSE clients to retrieve
      // In production, use Redis or similar
      const key = `sse_events:${event.eventId}`;
      const eventData = JSON.stringify(event);

      // For now, just log - in production implement proper SSE storage
      console.log(`SSE Event stored for ${key}:`, eventData);
    } catch (error) {
      console.error("Failed to store SSE event:", error);
    }
  }
}

// Server-Sent Events handler for real-time updates
export class SSEHandler {
  // Create SSE stream for event updates
  static createEventStream(eventId: string): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initialMessage = `data: ${JSON.stringify({
          type: "connected",
          eventId,
          timestamp: Date.now(),
        })}\n\n`;

        controller.enqueue(new TextEncoder().encode(initialMessage));

        // Set up periodic heartbeat
        const heartbeatInterval = setInterval(() => {
          const heartbeat = `data: ${JSON.stringify({
            type: "heartbeat",
            timestamp: Date.now(),
          })}\n\n`;

          try {
            controller.enqueue(new TextEncoder().encode(heartbeat));
          } catch (error) {
            console.error("SSE heartbeat error:", error);
            clearInterval(heartbeatInterval);
          }
        }, 30000); // 30 second heartbeat

        // Clean up on close
        return () => {
          clearInterval(heartbeatInterval);
        };
      },
    });
  }

  // Send event to SSE clients
  static async sendEventToClients(
    eventId: string,
    event: WebSocketEvent
  ): Promise<void> {
    try {
      // In a real implementation, this would send to active SSE connections
      // For now, we'll just log the event
      console.log(`SSE: Sending event to clients for ${eventId}:`, event);
    } catch (error) {
      console.error("Failed to send SSE event:", error);
    }
  }
}

// Utility functions for WebSocket event creation
export function createCameraJoinedEvent(
  eventId: string,
  participantId: string,
  cameraConnectionId: string,
  data: CameraJoinedEvent["data"]
): CameraJoinedEvent {
  return {
    type: "camera-joined",
    eventId,
    participantId,
    cameraConnectionId,
    timestamp: Date.now(),
    data,
  };
}

export function createCameraStartedStreamingEvent(
  eventId: string,
  participantId: string,
  cameraConnectionId: string,
  streamQuality: CameraStartedStreamingEvent["data"]["streamQuality"]
): CameraStartedStreamingEvent {
  return {
    type: "camera-started-streaming",
    eventId,
    participantId,
    cameraConnectionId,
    timestamp: Date.now(),
    data: { streamQuality },
  };
}

export function createCameraDisconnectedEvent(
  eventId: string,
  participantId: string,
  cameraConnectionId: string,
  reason: string,
  duration: number
): CameraDisconnectedEvent {
  return {
    type: "camera-disconnected",
    eventId,
    participantId,
    cameraConnectionId,
    timestamp: Date.now(),
    data: { reason, duration },
  };
}
