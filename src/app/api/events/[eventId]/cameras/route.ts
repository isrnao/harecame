import { NextRequest, NextResponse } from 'next/server';
import { CameraConnectionService } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    
    console.log('Fetching cameras for event:', eventId);

    // Get camera connections for the event
    const cameras = await CameraConnectionService.getByEventId(eventId);

    console.log('Found cameras:', cameras.length);

    return NextResponse.json({
      success: true,
      data: cameras,
    });

  } catch (error) {
    console.error('Failed to fetch cameras:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to fetch cameras',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}