import { NextRequest, NextResponse } from 'next/server';
import { StreamStatusService } from '@/lib/database';
import { getPublicEvent } from '@/server/events';
import { withErrorHandling } from '@/lib/middleware';
import { AppError } from '@/server/errors';
export const GET = withErrorHandling(async (_request: NextRequest, context: { params: Promise<{ eventId: string }> }) => {
  const { eventId } = await context.params;
  const event = await getPublicEvent(eventId);
  if (!event) throw new AppError(404, 'イベントが見つかりません');
  const status = await StreamStatusService.getByEventId(eventId);
  const stale = !status?.updatedAt || Date.now() - new Date(status.updatedAt).getTime() > 90000;
  return NextResponse.json({ success: true, data: { youtubeVideoId: event.youtubeVideoId, isLive: !stale && (status?.isLive ?? false),
    activeCameraCount: status?.activeCameraCount ?? 0, youtubeViewerCount: status?.youtubeViewerCount ?? 0,
    streamHealth: stale ? 'unknown' : status?.streamHealth ?? 'unknown', updatedAt: status?.updatedAt ?? null } });
});
// Provider-observed state cannot be assigned by a browser.
export async function PUT() { return NextResponse.json({ success: false, error: '配信操作APIを使用してください' }, { status: 405 }); }
