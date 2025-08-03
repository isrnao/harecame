import { Metadata } from 'next';
import Link from 'next/link';
import { EventService } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, Users, Video } from 'lucide-react';

// Next.js 15: App Router専用の最適化設定
export const dynamic = 'force-dynamic'; // イベントリストは動的データのため
export const revalidate = 30; // 30秒間隔でデータを再検証

export const metadata: Metadata = {
  title: 'イベント管理 - Harecame',
  description: 'ライブ配信イベントの管理画面',
};

export default async function EventsPage() {
  let events: Awaited<ReturnType<typeof EventService.list>> = [];

  try {
    events = await EventService.list({ limit: 20 });
  } catch (error) {
    console.error('Failed to load events:', error);
    events = [];
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">イベント管理</h1>
          <p className="text-muted-foreground">
            ライブ配信イベントの作成・管理を行います
          </p>
        </div>
        <Link href="/events/create">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新しいイベント
          </Button>
        </Link>
      </div>

      {events.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">イベントがありません</h3>
            <p className="text-muted-foreground mb-4">
              最初のライブ配信イベントを作成してみましょう
            </p>
            <Link href="/events/create">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                イベントを作成
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">{event.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {event.description && event.description.length > 100
                        ? `${event.description.substring(0, 100)}...`
                        : event.description || '説明なし'}
                    </CardDescription>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    event.status === 'live'
                      ? 'bg-red-100 text-red-700'
                      : event.status === 'scheduled'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {event.status === 'live' ? 'ライブ中' :
                     event.status === 'scheduled' ? '予定' : '終了'}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {event.scheduledAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(event.scheduledAt).toLocaleString('ja-JP')}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    参加コード: <code className="font-mono font-semibold">{event.participationCode}</code>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Link href={`/events/${event.id}/dashboard`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      ダッシュボード
                    </Button>
                  </Link>
                  {event.youtubeStreamUrl && (
                    <Link href={event.youtubeStreamUrl} target="_blank" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        配信を見る
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
