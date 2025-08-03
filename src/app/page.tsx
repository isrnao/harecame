import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Users, Eye } from 'lucide-react';
import { EventIdInput } from '@/components/ui/event-id-input';

// Next.js 15: App Router専用の最適化設定
export const dynamic = 'force-static'; // ホームページは静的コンテンツ
export const revalidate = 3600; // 1時間間隔で再生成

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Harecame（ハレカメ）
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            スマホで簡単に参加できるライブ配信サービス<br />
            学校行事やスポーツイベントを多角度から配信
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* 視聴者向け */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-xl">視聴者</CardTitle>
              <CardDescription>
                ライブ配信を視聴する
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600 mb-6">
                イベントのライブ配信を視聴できます。URLまたはイベントIDでアクセス。
              </p>
              <div className="space-y-2">
                <div className="text-sm text-gray-500">
                  イベントIDをお持ちの場合：
                </div>
                <EventIdInput />
              </div>
            </CardContent>
          </Card>

          {/* カメラオペレーター向け */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Video className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">カメラオペレーター</CardTitle>
              <CardDescription>
                スマホで配信に参加
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600 mb-6">
                参加コードを入力してスマホのカメラで配信に参加できます。
              </p>
              <Button asChild className="w-full">
                <Link href="/camera/join">
                  配信に参加
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* 主催者向け */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-xl">イベント主催者</CardTitle>
              <CardDescription>
                イベントを作成・管理
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600 mb-6">
                新しいイベントを作成し、配信を管理できます。
              </p>
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href="/events/create">
                    イベント作成
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/events">
                    イベント管理
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              簡単3ステップで配信開始
            </h2>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">1</div>
                <h3 className="font-semibold mb-1">イベント作成</h3>
                <p className="text-sm text-gray-600">主催者がイベントを作成し参加コードを発行</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">2</div>
                <h3 className="font-semibold mb-1">カメラ参加</h3>
                <p className="text-sm text-gray-600">参加者がスマホで参加コードを入力して配信開始</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">3</div>
                <h3 className="font-semibold mb-1">自動配信</h3>
                <p className="text-sm text-gray-600">最新のカメラに自動切り替えでYouTubeライブ配信</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
