import { NextRequest, NextResponse } from 'next/server';
import { EventService } from '@/lib/database';

// POST /api/events/validate-code - Validate participation code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { participationCode } = body;

    // Validate required fields
    if (!participationCode || typeof participationCode !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Participation code is required',
        },
        { status: 400 }
      );
    }

    // Find event by participation code
    const event = await EventService.getByParticipationCode(participationCode.toUpperCase());
    
    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error: 'Participation code not found',
        },
        { status: 404 }
      );
    }

    // Return event information (without sensitive data)
    return NextResponse.json({
      success: true,
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        scheduledAt: event.scheduledAt,
        status: event.status,
        participationCode: event.participationCode,
      },
    });
  } catch (error) {
    console.error('Failed to validate participation code:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate participation code',
      },
      { status: 500 }
    );
  }
}