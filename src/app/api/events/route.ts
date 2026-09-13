import { NextRequest, NextResponse } from 'next/server';
import { createEvent, listEvents } from '@/server/events';
import { requestActor } from '@/server/access';
import { withErrorHandling, rateLimit, RATE_LIMITS } from '@/lib/middleware';
import { listEventsQuerySchema } from '@/lib/validation';
export const GET = withErrorHandling(async (request: NextRequest) => {
  const options = listEventsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  return NextResponse.json({ success: true, data: await listEvents(await requestActor(request), options) });
});
export const POST = withErrorHandling(async (request: NextRequest) => {
  const limited = await rateLimit(RATE_LIMITS.createEvent)(request);
  if (limited) return limited;
  const event = await createEvent(await requestActor(request), await request.json());
  return NextResponse.json({ success: true, data: { event } }, { status: 201 });
});
