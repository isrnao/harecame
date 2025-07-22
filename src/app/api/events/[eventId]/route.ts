import { NextRequest, NextResponse } from "next/server";
import {
  EventService,
  CameraConnectionService,
  StreamStatusService,
} from "@/lib/database";
import { requireEventAccess } from "@/lib/auth";
import {
  rateLimit,
  validateRequestBody,
  withErrorHandling,
  requestLogger,
  securityHeaders,
  RATE_LIMITS,
} from "@/lib/middleware";
import { updateEventSchema } from "@/lib/validation";
import { isValidUUID } from "@/lib/validation";
import type { EventClient } from "@/types";

// GET /api/events/[eventId] - Get event by ID with related data
export const GET = withErrorHandling(
  async (
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
          error: "Invalid event ID format",
        },
        { status: 400, headers: securityHeaders() }
      );
    }

    const event = await EventService.getById(eventId);

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error: "Event not found",
        },
        { status: 404, headers: securityHeaders() }
      );
    }

    // Get additional data based on query parameters
    const { searchParams } = new URL(request.url);
    const includeCameras = searchParams.get("include_cameras") === "true";
    const includeStatus = searchParams.get("include_status") === "true";

    const responseData: {
      event: typeof event;
      cameras?: Awaited<
        ReturnType<typeof CameraConnectionService.getByEventId>
      >;
      streamStatus?: Awaited<
        ReturnType<typeof StreamStatusService.getByEventId>
      >;
    } = { event };

    if (includeCameras) {
      responseData.cameras = await CameraConnectionService.getByEventId(
        eventId
      );
    }

    if (includeStatus) {
      responseData.streamStatus = await StreamStatusService.getByEventId(
        eventId
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: responseData,
      },
      { headers: securityHeaders() }
    );
  }
);

// PUT /api/events/[eventId] - Update event
export const PUT = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ eventId: string }> }
  ) => {
    // Apply middleware
    requestLogger(request);

    const rateLimitResult = await rateLimit(RATE_LIMITS.default)(request);
    if (rateLimitResult) return rateLimitResult;

    const { eventId } = await context.params;

    // Require event-specific authentication for updates
    const authResult = await requireEventAccess(eventId, ['admin', 'organizer'])(request);
    if (authResult instanceof Response) return authResult;

    // Validate UUID format
    if (!isValidUUID(eventId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid event ID format",
        },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Validate request body
    const bodyValidation = await validateRequestBody(updateEventSchema)(
      request
    );
    if (bodyValidation instanceof NextResponse) return bodyValidation;

    // Check if event exists
    const existingEvent = await EventService.getById(eventId);
    if (!existingEvent) {
      return NextResponse.json(
        {
          success: false,
          error: "Event not found",
        },
        { status: 404, headers: securityHeaders() }
      );
    }

    // Convert scheduledAt string to Date if present
    const updateData = {
      ...bodyValidation.data,
      ...(bodyValidation.data.scheduledAt && {
        scheduledAt: new Date(bodyValidation.data.scheduledAt),
      }),
    } as Partial<EventClient>;

    const updatedEvent = await EventService.update(eventId, updateData);

    return NextResponse.json(
      {
        success: true,
        data: updatedEvent,
        message: "Event updated successfully",
      },
      { headers: securityHeaders() }
    );
  }
);

// DELETE /api/events/[eventId] - Delete event
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ eventId: string }> }
  ) => {
    // Apply middleware
    requestLogger(request);

    const rateLimitResult = await rateLimit(RATE_LIMITS.default)(request);
    if (rateLimitResult) return rateLimitResult;

    const { eventId } = await context.params;

    // Require event-specific authentication for deletion
    const authResult = await requireEventAccess(eventId, ['admin', 'organizer'])(request);
    if (authResult instanceof Response) return authResult;

    // Validate UUID format
    if (!isValidUUID(eventId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid event ID format",
        },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Check if event exists
    const existingEvent = await EventService.getById(eventId);
    if (!existingEvent) {
      return NextResponse.json(
        {
          success: false,
          error: "Event not found",
        },
        { status: 404, headers: securityHeaders() }
      );
    }

    // Check if event can be deleted (not live)
    if (existingEvent.status === "live") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete a live event",
        },
        { status: 400, headers: securityHeaders() }
      );
    }

    await EventService.delete(eventId);

    return NextResponse.json(
      {
        success: true,
        message: "Event deleted successfully",
      },
      { headers: securityHeaders() }
    );
  }
);
