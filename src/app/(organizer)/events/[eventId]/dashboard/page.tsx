import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { EventService, CameraConnectionService, StreamStatusService } from '@/lib/database';
import { EventDashboard } from '@/components/events/EventDashboard';
import { CameraStatusGrid } from '@/components/events/CameraStatusGrid';
import { QRCodeGenerator } from '@/components/events/QRCodeGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ダッシュボードアクセス情報の型定義
interface DashboardAccessLog {
  eventId: string;
  userAgent: string;
  timestamp: Date;
  activeCameras: number;
  totalCameras: number;
  streamStatus: string;
}

// ダッシュボードアクセスを記録する関数
async function recordDashboardAccess(accessLog: DashboardAccessLog) {
  console.log('Dashboard access recorded:', {
    eventId: accessLog.eventId,
    timestamp: accessLog.timestamp.toISOString(),
    activeCameras: accessLog.activeCameras,
    totalCameras: accessLog.totalCameras,
    streamStatus: accessLog.streamStatus,
    userAgent: accessLog.userAgent.substring(0, 100), // ログの簡略化
  });

  // 実際の実装では、データベースに保存
  // await database.dashboardAccess.create(accessLog);
}

interface DashboardPageProps {
  params: Promise<{ eventId: string }>;
}

export async function generateMetadata({ params }: DashboardPageProps): Promise<Metadata> {
  const { eventId } = await params;

  try {
    const event = await EventService.getById(eventId);
    if (!event) {
      return {
        title: 'イベントが見つかりません - Harecame',
      };
    }

    return {
      title: `${event.title} - ダッシュボード | Harecame`,
      description: `${event.title}のライブ配信ダッシュボード`,
    };
  } catch {
    return {
      title: 'エラー - Harecame',
    };
  }
}

export default async function EventDashboardPage({ params }: DashboardPageProps) {
  const { eventId } = await params;
  const headersList = await headers();

  let event: Awaited<ReturnType<typeof EventService.getById>>;
  let cameras: Awaited<ReturnType<typeof CameraConnectionService.getByEventId>>;
  let streamStatus: Awaited<ReturnType<typeof StreamStatusService.getByEventId>>;

  try {
    // Fetch event data
    event = await EventService.getById(eventId);
    if (!event) {
      notFound();
    }

    // Fetch related data
    [cameras, streamStatus] = await Promise.all([
      CameraConnectionService.getByEventId(eventId).catch(() => []),
      StreamStatusService.getByEventId(eventId).catch(() => null),
    ]);

    // after() APIを使用してダッシュボードアクセスのアナリティクスを応答後に記録
    after(async () => {
      try {
        await recordDashboardAccess({
          eventId,
          userAgent: headersList.get('user-agent') || 'unknown',
          timestamp: new Date(),
          activeCameras: cameras.filter(c => c.status === 'active').length,
          totalCameras: cameras.length,
          streamStatus: streamStatus?.isLive ? 'live' : 'offline',
        });
      } catch (error) {
        console.error('Failed to record dashboard analytics:', error);
      }
    });
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    // エラーの詳細をログに記録
    if (error instanceof Error) {
      console.error('Dashboard error details:', {
        message: error.message,
        stack: error.stack,
        eventId,
        timestamp: new Date().toISOString(),
      });
    }
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="cameras">カメラ管理</TabsTrigger>
          <TabsTrigger value="qrcode">参加QR</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <EventDashboard
            event={event}
            initialCameras={cameras}
            initialStreamStatus={streamStatus || undefined}
          />
        </TabsContent>

        <TabsContent value="cameras" className="space-y-6">
          <CameraStatusGrid
            eventId={eventId}
            initialCameras={cameras}
          />
        </TabsContent>

        <TabsContent value="qrcode" className="space-y-6">
          <QRCodeGenerator event={event} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
