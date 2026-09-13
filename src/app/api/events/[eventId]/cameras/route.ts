import { NextRequest, NextResponse } from 'next/server';
import { getDashboard } from '@/server/events';
import { requestActor } from '@/server/access';
import { withErrorHandling } from '@/lib/middleware';
export const GET = withErrorHandling(async (request: NextRequest, context: { params: Promise<{ eventId: string }> }) => {
  const { cameras } = await getDashboard(await requestActor(request), (await context.params).eventId);
  return NextResponse.json({ success: true, data: cameras });
});
