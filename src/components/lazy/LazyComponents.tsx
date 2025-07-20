'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Loading component for lazy-loaded components
function ComponentLoader({ message = "読み込み中..." }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{message}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Lazy-loaded CameraStreamInterface
export const LazyCameraStreamInterface = dynamic(
  () => import('@/components/camera/CameraStreamInterface').then(mod => ({ 
    default: mod.CameraStreamInterface 
  })),
  {
    loading: () => <ComponentLoader message="カメラインターフェースを読み込み中..." />,
    ssr: false, // カメラ機能はクライアントサイドのみ
  }
);

// Lazy-loaded EventDashboard
export const LazyEventDashboard = dynamic(
  () => import('@/components/events/EventDashboard').then(mod => ({ 
    default: mod.EventDashboard 
  })),
  {
    loading: () => <ComponentLoader message="ダッシュボードを読み込み中..." />,
    ssr: true, // SEOのためサーバーサイドレンダリングを有効
  }
);

// Lazy-loaded StreamViewer
export const LazyStreamViewer = dynamic(
  () => import('@/components/stream/StreamViewer').then(mod => ({ 
    default: mod.StreamViewer 
  })),
  {
    loading: () => <ComponentLoader message="ストリーム視聴画面を読み込み中..." />,
    ssr: false, // YouTube埋め込みはクライアントサイドのみ
  }
);

// Lazy-loaded QRCodeGenerator
export const LazyQRCodeGenerator = dynamic(
  () => import('@/components/events/QRCodeGenerator').then(mod => ({ 
    default: mod.QRCodeGenerator 
  })),
  {
    loading: () => <ComponentLoader message="QRコードを生成中..." />,
    ssr: false, // QRコード生成はクライアントサイドのみ
  }
);

// Lazy-loaded EventCreationForm
export const LazyEventCreationForm = dynamic(
  () => import('@/components/events/EventCreationForm').then(mod => ({ 
    default: mod.EventCreationForm 
  })),
  {
    loading: () => <ComponentLoader message="フォームを読み込み中..." />,
    ssr: true,
  }
);

// Wrapper component with Suspense boundary
export function LazyComponentWrapper({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback || <ComponentLoader />}>
      {children}
    </Suspense>
  );
}