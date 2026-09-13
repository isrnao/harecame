import { NextRequest, NextResponse } from 'next/server';
import { requestActor } from '@/server/access';
import { controlStream, getControlState } from '@/server/streaming';
import { withErrorHandling } from '@/lib/middleware';
export const runtime = 'nodejs';
export const maxDuration = 300;
type Context = { params: Promise<{ eventId: string }> };
export const GET = withErrorHandling(async (request: NextRequest, context: Context) =>
  NextResponse.json({ success: true, data: await getControlState(await requestActor(request), (await context.params).eventId) }));
export const POST = withErrorHandling(async (request: NextRequest, context: Context) =>
  NextResponse.json({ success: true, data: await controlStream(await requestActor(request), (await context.params).eventId, await request.json()) }));
