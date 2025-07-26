import { NextRequest, NextResponse } from 'next/server';
import { CameraConnectionService } from '@/lib/database';

// Next.js 15: カメラ状態はリアルタイムデータのためキャッシュ無効
export const dynamic = 'force-dynamic';

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
    }, {
      headers: {
        // Next.js 15: リアルタイムデータのためキャッシュ無効
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
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