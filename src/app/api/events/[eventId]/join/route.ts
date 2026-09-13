import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requestActor } from '@/server/access';
import { admitCamera } from '@/server/cameras';
import { withErrorHandling, rateLimit, RATE_LIMITS } from '@/lib/middleware';
export const POST = withErrorHandling(async (request: NextRequest, context: { params: Promise<{ eventId: string }> }) => {
  const eventId = z.uuid().parse((await context.params).eventId);
  const limited = await rateLimit(RATE_LIMITS.joinEvent)(request);
  if (limited) return limited;
  return NextResponse.json({ success: true, data: await admitCamera(await requestActor(request, eventId), eventId, await request.json()) });
});
