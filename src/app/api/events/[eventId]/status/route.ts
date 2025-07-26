import { NextRequest, NextResponse } from 'next/server';
import { StreamStatusService, EventService, CameraConnectionService } from '@/lib/database';
import { 
  rateLimit, 
  validateRequestBody, 
  withErrorHandling, 
  requestLogger,
  securityHeaders,
  requireAuth,
  RATE_LIMITS 
} from '@/lib/middleware';
import { updateStreamStatusSchema } from '@/lib/validation';
import { isValidUUID } from '@/lib/validation';

// Next.js 15: ストリーム状態はリアルタイムデータのためキャッシュ無効
export const dynamic = 'force-dynamic';

// GET /api/events/[eventId]/status - Get comprehensive stream status for an event
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) => {
  // Apply middleware
  requestLogger(request);
  
  const rateLimitResult = await rateLimit(RATE_LIMITS.default)(request);
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

  // Verify event exists
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

  // Get stream status
  const streamStatus = await StreamStatusService.getByEventId(eventId);
  
  // Get camera connections for additional context
  const cameras = await CameraConnectionService.getByEventId(eventId);
  const activeCameras = cameras.filter(camera => camera.status === 'active');

  // Calculate real-time metrics
  const realTimeStatus = {
    ...streamStatus,
    activeCameraCount: activeCameras.length,
    totalCameraCount: cameras.length,
    isLive: activeCameras.length > 0,
    lastUpdated: new Date().toISOString(),
  };

  // Update stream status if it's outdated
  if (!streamStatus || streamStatus.activeCameraCount !== activeCameras.length) {
    await StreamStatusService.upsert({
      eventId,
      isLive: activeCameras.length > 0,
      activeCameraCount: activeCameras.length,
      currentActiveCamera: activeCameras.length > 0 
        ? activeCameras.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())[0].id
        : undefined,
    });
  }

  return NextResponse.json(
    {
      success: true,
      data: realTimeStatus,
      cameras: activeCameras.map(camera => ({
        id: camera.id,
        participantId: camera.participantId,
        participantName: camera.participantName,
        status: camera.status,
        joinedAt: camera.joinedAt,
        streamQuality: camera.streamQuality,
      })),
    },
    { 
      headers: {
        ...securityHeaders(),
        // Next.js 15: リアルタイムデータのためキャッシュ無効
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    }
  );
});

// PUT /api/events/[eventId]/status - Update stream status
export const PUT = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) => {
  // Apply middleware
  requestLogger(request);
  
  const rateLimitResult = await rateLimit(RATE_LIMITS.statusUpdate)(request);
  if (rateLimitResult) return rateLimitResult;

  // Require authentication for status updates
  const authResult = requireAuth(request);
  if (authResult) return authResult;

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

  // Verify event exists
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

  // Validate request body
  const bodyValidation = await validateRequestBody(updateStreamStatusSchema)(request);
  if (bodyValidation instanceof NextResponse) return bodyValidation;

  const streamStatus = await StreamStatusService.upsert({
    eventId,
    ...bodyValidation.data,
  });

  return NextResponse.json(
    {
      success: true,
      data: streamStatus,
      message: 'Stream status updated successfully',
    },
    { headers: securityHeaders() }
  );
});