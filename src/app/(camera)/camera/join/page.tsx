import { Metadata } from 'next';
import { Suspense } from 'react';
import { CameraJoinForm } from '@/components/camera/CameraJoinForm';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'カメラで参加 - Harecame',
  description: 'ライブ配信にカメラオペレーターとして参加します',
};

interface CameraJoinPageProps {
  searchParams: Promise<{ code?: string }>;
}

function CameraJoinContent({ participationCode }: { participationCode?: string }) {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Camera className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Harecame</h1>
        </div>
        <p className="text-muted-foreground">
          ライブ配信にカメラオペレーターとして参加しましょう
        </p>
      </div>
      
      <CameraJoinForm initialParticipationCode={participationCode} />
      
      <div className="mt-8 text-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">初めての方へ</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• カメラとマイクの使用許可が必要です</p>
              <p>• 安定したインターネット接続を推奨します</p>
              <p>• スマートフォンでの参加が最適です</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function CameraJoinPage({ searchParams }: CameraJoinPageProps) {
  // Next.js 15: searchParams を async/await パターンで使用
  const resolvedSearchParams = await searchParams;
  const { code } = resolvedSearchParams;

  return (
    <Suspense fallback={
      <div className="container mx-auto py-8 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>読み込み中...</p>
      </div>
    }>
      <CameraJoinContent participationCode={code} />
    </Suspense>
  );
}