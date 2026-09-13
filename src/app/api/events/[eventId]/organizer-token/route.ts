import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { AuthService } from '@/lib/auth';
import { authorize, requestActor } from '@/server/access';
import { getPublicEvent } from '@/server/events';
import { withErrorHandling } from '@/lib/middleware';
import { AppError } from '@/server/errors';
export const POST = withErrorHandling(async (request: NextRequest, context: { params: Promise<{ eventId: string }> }) => {
  const actor = await requestActor(request); authorize(actor, []);
  const { eventId } = await context.params;
  if (!await getPublicEvent(eventId)) throw new AppError(404, 'イベントが見つかりません');
  return NextResponse.json({ success: true, data: { token: await AuthService.generateOrganizerToken(randomUUID(), eventId) } });
});
