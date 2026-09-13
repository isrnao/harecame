import { NextRequest, NextResponse } from 'next/server';
import { getPublicEvent, getDashboard, updateEvent, deleteEvent } from '@/server/events';
import { requestActor } from '@/server/access';
import { withErrorHandling, rateLimit, RATE_LIMITS } from '@/lib/middleware';
import { z } from 'zod';
type Context = { params: Promise<{ eventId: string }> };
export const GET = withErrorHandling(async (request: NextRequest, context: Context) => {
  const id = z.uuid().parse((await context.params).eventId);
  const limited = await rateLimit(RATE_LIMITS.default)(request); if (limited) return limited;
  const includeCameras = request.nextUrl.searchParams.get('include_cameras') === 'true';
  const includeStatus = request.nextUrl.searchParams.get('include_status') === 'true';
  const dashboard = includeCameras || includeStatus ? await getDashboard(await requestActor(request), id) : null;
  const data = dashboard ? { event: dashboard.event,
    ...(includeCameras && { cameras: dashboard.cameras }), ...(includeStatus && { streamStatus: dashboard.streamStatus }) }
    : { event: await getPublicEvent(id) };
  return NextResponse.json({ success: !!data.event, data }, { status: data.event ? 200 : 404 });
});
export const PUT = withErrorHandling(async (request: NextRequest, context: Context) => {
  const id = z.uuid().parse((await context.params).eventId);
  return NextResponse.json({ success: true, data: await updateEvent(await requestActor(request), id, await request.json()) });
});
export const DELETE = withErrorHandling(async (request: NextRequest, context: Context) => {
  const id = z.uuid().parse((await context.params).eventId);
  await deleteEvent(await requestActor(request), id);
  return NextResponse.json({ success: true });
});
