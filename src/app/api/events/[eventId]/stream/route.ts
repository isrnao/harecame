import { NextRequest, NextResponse } from 'next/server';
import { SSEHandler } from '@/lib/websocket';
import { EventService } from '@/lib/database';

// GET /api/events/[eventId]/stream - Server-Sent Events for real-time updates
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;

    // Verify event exists
    const event = await EventService.getById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Create SSE stream
    const stream = SSEHandler.createEventStream(eventId);

    // Return SSE response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('Failed to create SSE stream:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create event stream' },
      { status: 500 }
    );
  }
}