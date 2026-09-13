import { NextRequest, NextResponse } from 'next/server';
import { StreamStatusService } from '@/lib/database';
import { getPublicEvent } from '@/server/events';
import { withErrorHandling } from '@/lib/middleware';
import { AppError } from '@/server/errors';
export const GET = withErrorHandling(async (_request: NextRequest, context: { params: Promise<{ eventId: string }> }) => {
  const { eventId } = await context.params;
  if (!await getPublicEvent(eventId)) throw new AppError(404, 'イベントが見つかりません');
  const status = await StreamStatusService.getByEventId(eventId);
  return NextResponse.json({ success: true, data: { isLive: status?.isLive ?? false,
    activeCameraCount: status?.activeCameraCount ?? 0, youtubeViewerCount: status?.youtubeViewerCount ?? 0,
    streamHealth: status?.streamHealth ?? 'unknown', updatedAt: status?.updatedAt ?? null } });
});
// Provider-observed state cannot be assigned by a browser.
export async function PUT() { return NextResponse.json({ success: false, error: '配信操作APIを使用してください' }, { status: 405 }); }
