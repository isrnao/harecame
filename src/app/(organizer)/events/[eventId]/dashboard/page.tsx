import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventService, CameraConnectionService, StreamStatusService } from '@/lib/database';
import { EventDashboard } from '@/components/events/EventDashboard';
import { CameraStatusGrid } from '@/components/events/CameraStatusGrid';
import { QRCodeGenerator } from '@/components/events/QRCodeGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  let event;
  let cameras;
  let streamStatus;

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
          <QRCodeGenerator 
            key={event.participationCode} 
            event={event} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}