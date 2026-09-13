import { limitAdmission } from '@/server/admission-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCameraCode, cameraIdentity } from '@/server/cameras';
import { publicEvent } from '@/server/events';
import { withErrorHandling } from '@/lib/middleware';
export const POST = withErrorHandling(async (request: NextRequest) => {
  await limitAdmission(request.headers);
  const body = await request.json();
  const event = await validateCameraCode(body);
  const name = z.string().max(100).optional().parse(body.participantName);
  const { id, token } = await cameraIdentity(event.id, name);
  return NextResponse.json({ success: true, data: { event: publicEvent(event), participant: { id, name }, tokens: { accessToken: token } } });
});
