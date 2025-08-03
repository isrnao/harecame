import { Metadata } from 'next';
import { EventCreationForm } from '@/components/events/EventCreationForm';

// Next.js 15: 静的ルート最適化のためのdynamic設定
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'イベント作成 - Harecame',
  description: '新しいライブ配信イベントを作成します',
};

export default function CreateEventPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">
          新しいイベントを作成
        </h1>
        <p className="text-muted-foreground text-center">
          ライブ配信イベントの基本情報を入力して、参加者が簡単に参加できるイベントを作成しましょう
        </p>
      </div>

      <EventCreationForm />
    </div>
  );
}
