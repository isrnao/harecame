import { NextRequest, NextResponse } from 'next/server';
import { EventService, CameraConnectionService, EventLogService } from '@/lib/database';
import { generateAccessToken } from '@/lib/livekit';
import { AuthService } from '@/lib/auth';
import { 
  rateLimit, 
  validateRequestBody, 
  withErrorHandling, 
  requestLogger,
  securityHeaders,
  RATE_LIMITS 
} from '@/lib/middleware';
import { joinEventSchema } from '@/lib/validation';
import { isValidUUID } from '@/lib/validation';
import { WebSocketEventHandler, createCameraJoinedEvent } from '@/lib/websocket';

// POST /api/events/[eventId]/join - Join event as camera operator
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) => {
  // Apply middleware
  requestLogger(request);
  
  const rateLimitResult = await rateLimit(RATE_LIMITS.joinEvent)(request);
  if (rateLimitResult) return rateLimitResult;

  const { eventId } = await context.params;

  // Validate UUID format
  if (!isValidUUID(eventId)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid event ID format',
      },
      { status: 400, headers: securityHeaders() }
    );
  }

  // Check camera access authentication
  const cameraAccess = await AuthService.hasCameraAccess(request, eventId);
  if (!cameraAccess.hasAccess) {
    return NextResponse.json(
      {
        success: false,
        error: 'Camera access authentication required. Please validate participation code first.',
      },
      { status: 401, headers: securityHeaders() }
    );
  }

  // Validate request body
  const bodyValidation = await validateRequestBody(joinEventSchema)(request);
  if (bodyValidation instanceof NextResponse) return bodyValidation;
  
  const { participantId, participantName, deviceInfo } = bodyValidation.data;

  // Use authenticated participant info if available
  const authenticatedParticipantId = cameraAccess.participantId || participantId;
  const authenticatedParticipantName = cameraAccess.participantName || participantName;

  // Get event information
  const event = await EventService.getById(eventId);
  if (!event) {
    return NextResponse.json(
      {
        success: false,
        error: 'Event not found',
      },
      { status: 404, headers: securityHeaders() }
    );
  }

  // Check if event is active
  if (event.status === 'ended') {
    return NextResponse.json(
      {
        success: false,
        error: 'Event has ended',
      },
      { status: 400, headers: securityHeaders() }
    );
  }

  // Check if participant is already connected
  const existingCameras = await CameraConnectionService.getByEventId(eventId);
  const existingConnection = existingCameras.find(
    camera => camera.participantId === authenticatedParticipantId && camera.status !== 'inactive'
  );

  if (existingConnection) {
    return NextResponse.json(
      {
        success: false,
        error: 'Participant is already connected to this event',
        data: {
          existingConnectionId: existingConnection.id,
        },
      },
      { status: 409, headers: securityHeaders() }
    );
  }

  // Check camera limit (max 10 cameras per event)
  const activeCameras = existingCameras.filter(camera => camera.status === 'active');
  if (activeCameras.length >= 10) {
    return NextResponse.json(
      {
        success: false,
        error: 'Maximum number of cameras reached for this event',
      },
      { status: 429, headers: securityHeaders() }
    );
  }

  // Create camera connection record
  const cameraConnection = await CameraConnectionService.create({
    eventId,
    participantId: authenticatedParticipantId,
    participantName: authenticatedParticipantName,
    deviceInfo: deviceInfo || {},
  });

  // Generate LiveKit access token
  let roomToken: string;
  try {
    roomToken = await generateAccessToken(
      event.livekitRoomName,
      authenticatedParticipantId,
      {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        metadata: JSON.stringify({
          participantName: authenticatedParticipantName || authenticatedParticipantId,
          cameraConnectionId: cameraConnection.id,
        }),
      }
    );
  } catch (error) {
    console.error('Failed to generate LiveKit token:', error);
    
    // Clean up the camera connection if token generation fails
    await CameraConnectionService.delete(cameraConnection.id);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate access token',
      },
      { status: 500, headers: securityHeaders() }
    );
  }

  // Create and handle camera joined event
  const cameraJoinedEvent = createCameraJoinedEvent(
    eventId,
    authenticatedParticipantId,
    cameraConnection.id,
    {
      participantName: authenticatedParticipantName,
      deviceInfo: deviceInfo || {},
    }
  );

  // Handle the event asynchronously (don't block the response)
  WebSocketEventHandler.handleCameraJoined(cameraJoinedEvent).catch(error => {
    console.error('Failed to handle camera joined event:', error);
  });

  // Log the join event
  EventLogService.create({
    eventId,
    cameraConnectionId: cameraConnection.id,
    logType: 'camera_join_request',
    message: `Camera operator ${authenticatedParticipantId} requested to join`,
    metadata: {
      participantName: authenticatedParticipantName,
      deviceInfo,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    },
  }).catch(error => {
    console.error('Failed to log join event:', error);
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        eventId,
        roomToken,
        roomName: event.livekitRoomName,
        cameraConnectionId: cameraConnection.id,
        event: {
          title: event.title,
          description: event.description,
          status: event.status,
        },
      },
      message: 'Successfully joined event as camera operator',
    },
    { 
      status: 201,
      headers: securityHeaders(),
    }
  );
});