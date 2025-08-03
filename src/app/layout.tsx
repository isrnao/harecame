import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { after } from 'next/server';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Harecame - ライブ配信サービス',
  description: 'スマホで簡単に参加できるライブ配信サービス',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Harecame',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#3b82f6',
};

import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { AppInitializer } from '@/components/AppInitializer';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // after() APIを使用してアプリケーション初期化ログを応答後に記録
  after(async () => {
    try {
      console.log('Application layout rendered, logging initialization metrics');
      // 実際の実装では、アプリケーション起動メトリクスを記録
      // await logApplicationStartup();
    } catch (error) {
      console.error('Failed to log application startup:', error);
    }
  });

  return (
    <html lang="ja">
      <body className={inter.className}>
        <AppInitializer />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
