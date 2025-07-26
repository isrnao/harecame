import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth';
import { participationCodeSchema } from '@/lib/validation';
import { rateLimit, RATE_LIMITS, withErrorHandling, requestLogger } from '@/lib/middleware';

// キャッシュ設定: 参加コード検証はキャッシュしない
export const dynamic = 'force-dynamic';

// POST /api/events/validate-code - Validate participation code and generate camera token
export const POST = withErrorHandling(async (request: NextRequest) => {
  requestLogger(request);
  
  // Apply rate limiting
  const rateLimitResult = await rateLimit(RATE_LIMITS.joinEvent)(request);
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  
  // Validate request body
  const validation = participationCodeSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid participation code format',
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { code: participationCode } = validation.data;
  
  // Generate participant ID (could be from request or generated)
  const participantId = body.participantId || `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const participantName = body.participantName;

  // Validate participation code and generate token
  const result = await AuthService.validateParticipationCodeAndGenerateToken(
    participationCode,
    participantId,
    participantName
  );

  if (!result) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid participation code or event has ended',
      },
      { status: 404 }
    );
  }

  const { token, event } = result;

  // Generate LiveKit token for streaming
  const liveKitToken = await AuthService.generateLiveKitToken(
    participantId,
    event.id,
    participantName
  );

  // Return event information and tokens
  return NextResponse.json({
    success: true,
    data: {
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        scheduledAt: event.scheduledAt,
        status: event.status,
      },
      participant: {
        id: participantId,
        name: participantName,
      },
      tokens: {
        accessToken: token,
        liveKitToken: liveKitToken,
      },
    },
  });
});