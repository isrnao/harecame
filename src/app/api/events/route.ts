import { NextRequest, NextResponse } from 'next/server';
import { EventService } from '@/lib/database';
import { createYouTubeLiveStream } from '@/lib/youtube';
import { AuthService } from '@/lib/auth';
import { 
  rateLimit, 
  validateRequestBody, 
  validateQueryParams, 
  withErrorHandling, 
  requestLogger,
  securityHeaders,
  RATE_LIMITS 
} from '@/lib/middleware';
import { createEventSchema, listEventsQuerySchema } from '@/lib/validation';

// GET /api/events - List events
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Apply middleware
  requestLogger(request);
  
  const rateLimitResult = await rateLimit(RATE_LIMITS.default)(request);
  if (rateLimitResult) return rateLimitResult;

  // Validate query parameters
  const queryValidation = validateQueryParams(listEventsQuerySchema)(request);
  if (queryValidation instanceof NextResponse) return queryValidation;
  
  const { limit = 20, offset = 0, status } = queryValidation.data;

  const events = await EventService.list({
    limit,
    offset,
    status,
  });

  return NextResponse.json(
    {
      success: true,
      data: events,
      pagination: {
        limit,
        offset,
        total: events.length,
      },
    },
    { 
      headers: {
        ...securityHeaders(),
        // Next.js 15: イベント一覧は5分間キャッシュ
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      }
    }
  );
});

// POST /api/events - Create new event (requires admin authentication)
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply middleware
  requestLogger(request);
  
  const rateLimitResult = await rateLimit(RATE_LIMITS.createEvent)(request);
  if (rateLimitResult) return rateLimitResult;

  // Check admin authentication
  const hasAdminAccess = await AuthService.hasAdminAccess(request);
  if (!hasAdminAccess) {
    return NextResponse.json(
      {
        success: false,
        error: 'Admin authentication required to create events',
      },
      { status: 401 }
    );
  }

  // Validate request body
  const bodyValidation = await validateRequestBody(createEventSchema)(request);
  if (bodyValidation instanceof NextResponse) return bodyValidation;
  
  const { title, description, scheduledAt } = bodyValidation.data;

  // Create event
  const event = await EventService.create({
    title,
    description,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
  });

  // Generate organizer token for the event creator
  const organizerId = `organizer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const organizerToken = await AuthService.generateOrganizerToken(organizerId, event.id);

  // Create YouTube Live stream
  try {
    const youtubeStream = await createYouTubeLiveStream({
      title: event.title,
      description: event.description,
      scheduledStartTime: event.scheduledAt,
      privacy: 'unlisted',
    });

    // Update event with YouTube stream information
    const updatedEvent = await EventService.update(event.id, {
      youtubeStreamUrl: youtubeStream.streamUrl,
      youtubeStreamKey: youtubeStream.streamKey,
      youtubeVideoId: youtubeStream.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          event: updatedEvent,
          organizer: {
            id: organizerId,
            token: organizerToken,
          },
        },
        message: 'Event created successfully with YouTube integration',
      },
      { 
        status: 201,
        headers: securityHeaders(),
      }
    );
  } catch (youtubeError) {
    console.error('Failed to create YouTube stream:', youtubeError);
    
    // Return event without YouTube integration
    return NextResponse.json(
      {
        success: true,
        data: {
          event,
          organizer: {
            id: organizerId,
            token: organizerToken,
          },
        },
        warning: 'Event created but YouTube integration failed',
        message: 'Event created successfully (YouTube integration failed)',
      },
      { 
        status: 201,
        headers: securityHeaders(),
      }
    );
  }
});