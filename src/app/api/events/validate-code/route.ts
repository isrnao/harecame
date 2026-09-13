import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCameraCode, cameraIdentity } from '@/server/cameras';
import { publicEvent } from '@/server/events';
import { rateLimit, RATE_LIMITS, withErrorHandling } from '@/lib/middleware';
export const POST = withErrorHandling(async (request: NextRequest) => {
  const limited = await rateLimit(RATE_LIMITS.joinEvent)(request);
  if (limited) return limited;
  const body = await request.json();
  const event = await validateCameraCode(body);
  const name = z.string().max(100).optional().parse(body.participantName);
  const { id, token } = await cameraIdentity(event.id, name);
  return NextResponse.json({ success: true, data: { event: publicEvent(event), participant: { id, name }, tokens: { accessToken: token } } });
});
