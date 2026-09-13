import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthService, SessionService } from '@/lib/auth';
import { withErrorHandling, rateLimit, RATE_LIMITS } from '@/lib/middleware';
import { AppError } from '@/server/errors';
export const POST = withErrorHandling(async (request: NextRequest) => {
  const limited = await rateLimit(RATE_LIMITS.joinEvent)(request); if (limited) return limited;
  const { token } = z.object({ token: z.string().min(1).max(4096) }).parse(await request.json());
  const actor = await AuthService.verifyToken(token);
  if (actor?.type !== 'organizer' || !actor.eventId) throw new AppError(401, 'ログインコードが無効または期限切れです');
  return NextResponse.json({ success: true, data: { eventId: actor.eventId } }, { headers: { 'Set-Cookie': SessionService.createSessionCookie(token) } });
});
