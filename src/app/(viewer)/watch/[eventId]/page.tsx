import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { StreamViewer } from '@/components/stream/StreamViewer';
import { getEventById } from '@/app/actions/events';

// Next.js 15: App Router専用の最適化設定
export const dynamic = 'force-dynamic'; // 動的パラメータとリアルタイムストリームのため
export const runtime = 'edge'; // 視聴者向けページはエッジランタイムで高速化
export const revalidate = 60; // 1分間隔でイベント情報を再検証

interface ViewerPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function ViewerPage({ params }: ViewerPageProps) {
  const { eventId } = await params;

  const event = await getEventById(eventId);

  if (!event) {
    notFound();
  }

  // Next.js 15: after() APIを使用して視聴開始のアナリティクスを応答後に記録
  after(async () => {
    try {
      console.log('Viewer page accessed:', {
        eventId,
        eventTitle: event.title,
        timestamp: new Date().toISOString(),
        hasStreamUrl: !!event.youtubeStreamUrl,
      });
      // 実際の実装では、アナリティクスサービスに送信
      // await analyticsService.trackViewerAccess({ eventId, timestamp: new Date() });
    } catch (error) {
      console.error('Failed to record viewer analytics:', error);
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              {event.title}
            </h1>
            {event.description && (
              <p className="text-sm sm:text-base text-gray-600">{event.description}</p>
            )}
          </div>

          <Suspense fallback={
            <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-gray-600">ストリームを読み込み中...</p>
              </div>
            </div>
          }>
            <StreamViewer
              eventId={eventId}
              streamUrl={event.youtubeStreamUrl || ''}
              eventTitle={event.title}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
