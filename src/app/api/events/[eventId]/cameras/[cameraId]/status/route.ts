import { NextRequest, NextResponse } from 'next/server';
import { CameraConnectionService, EventLogService } from '@/lib/database';
import { 
  rateLimit, 
  validateRequestBody, 
  withErrorHandling, 
  requestLogger,
  securityHeaders,
  RATE_LIMITS 
} from '@/lib/middleware';
import { updateCameraStatusSchema } from '@/lib/validation';
import { isValidUUID } from '@/lib/validation';
import { 
  WebSocketEventHandler, 
  createCameraStartedStreamingEvent, 
  createCameraDisconnectedEvent 
} from '@/lib/websocket';

// キャッシュ設定: カメラ状態更新はキャッシュしない
export const dynamic = 'force-dynamic';

export const PUT = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; cameraId: string }> }
) => {
  // Apply middleware
  requestLogger(request);
  
  const rateLimitResult = await rateLimit(RATE_LIMITS.statusUpdate)(request);
  if (rateLimitResult) return rateLimitResult;

  const { eventId, cameraId } = await params;
  
  // Validate UUID formats
  if (!isValidUUID(eventId) || !isValidUUID(cameraId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid ID format',
      },
      { status: 400, headers: securityHeaders() }
    );
  }

  // Validate request body
  const bodyValidation = await validateRequestBody(updateCameraStatusSchema)(request);
  if (bodyValidation instanceof NextResponse) return bodyValidation;
  
  const { status, streamQuality } = bodyValidation.data;

  console.log('Updating camera status:', {
    eventId,
    cameraId,
    status,
    streamQuality
  });

  // Get current camera connection to check previous status
  const currentCamera = await CameraConnectionService.getById(cameraId);
  if (!currentCamera) {
    return NextResponse.json(
      {
        success: false,
        error: 'Camera connection not found',
      },
      { status: 404, headers: securityHeaders() }
    );
  }

  // Verify camera belongs to the event
  if (currentCamera.eventId !== eventId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Camera does not belong to this event',
      },
      { status: 400, headers: securityHeaders() }
    );
  }

  const previousStatus = currentCamera.status;

  // Update camera connection status
  const updatedCamera = await CameraConnectionService.updateStatus(
    cameraId,
    status,
    streamQuality
  );

  console.log('Camera status updated successfully:', updatedCamera.id);

  // Handle WebSocket events based on status changes
  if (status === 'active' && previousStatus !== 'active' && streamQuality) {
    // Camera started streaming
    const streamingEvent = createCameraStartedStreamingEvent(
      eventId,
      currentCamera.participantId,
      cameraId,
      {
        resolution: streamQuality.resolution || 'unknown',
        frameRate: streamQuality.frameRate || 0,
        bitrate: streamQuality.bitrate || 0,
        codec: streamQuality.codec || 'unknown',
      }
    );

    // Handle the event asynchronously
    WebSocketEventHandler.handleCameraStartedStreaming(streamingEvent).catch(error => {
      console.error('Failed to handle camera started streaming event:', error);
    });

  } else if (status === 'inactive' && previousStatus === 'active') {
    // Camera disconnected
    const disconnectionDuration = currentCamera.joinedAt 
      ? Math.floor((Date.now() - new Date(currentCamera.joinedAt).getTime()) / 1000)
      : 0;

    const disconnectedEvent = createCameraDisconnectedEvent(
      eventId,
      currentCamera.participantId,
      cameraId,
      'manual_disconnect',
      disconnectionDuration
    );

    // Handle the event asynchronously
    WebSocketEventHandler.handleCameraDisconnected(disconnectedEvent).catch(error => {
      console.error('Failed to handle camera disconnected event:', error);
    });
  }

  // Log the status change
  EventLogService.create({
    eventId,
    cameraConnectionId: cameraId,
    logType: 'camera_status_update',
    message: `Camera status changed from ${previousStatus} to ${status}`,
    metadata: {
      previousStatus,
      newStatus: status,
      streamQuality,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    },
  }).catch(error => {
    console.error('Failed to log status update:', error);
  });

  return NextResponse.json(
    {
      success: true,
      message: 'Camera status updated successfully',
      data: updatedCamera,
    },
    { headers: securityHeaders() }
  );
});