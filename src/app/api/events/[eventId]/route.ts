import { NextRequest, NextResponse } from 'next/server';
import { getPublicEvent, getDashboard, updateEvent, deleteEvent } from '@/server/events';
import { requestActor } from '@/server/access';
import { withErrorHandling } from '@/lib/middleware';
import { z } from 'zod';
type Context = { params: Promise<{ eventId: string }> };
export const GET = withErrorHandling(async (request: NextRequest, context: Context) => {
  const id = z.uuid().parse((await context.params).eventId);
  const details = request.nextUrl.searchParams.get('include_cameras') === 'true' || request.nextUrl.searchParams.get('include_status') === 'true';
  const data = details ? await getDashboard(await requestActor(request), id) : { event: await getPublicEvent(id) };
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
