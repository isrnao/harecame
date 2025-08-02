'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Download, Copy, ExternalLink } from 'lucide-react';
import type { EventClient } from '@/types';
import { useClipboardHandler } from '@/lib/event-handlers';

interface QRCodeGeneratorProps {
  event: EventClient;
}

export function QRCodeGenerator({ event }: QRCodeGeneratorProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const copyToClipboard = useClipboardHandler();

  // React 19: 計算結果のキャッシュ最適化 - useMemoで高価な計算をキャッシュ
  const cameraJoinUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/camera/join?code=${event.participationCode}`;
  }, [event.participationCode]);

  // React 19: Ref cleanup 最適化パターン
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!cameraJoinUrl) return;

    let isCancelled = false;
    setIsGenerating(true);

    const generateQRCode = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(cameraJoinUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });

        if (!isCancelled) {
          setQrCodeDataUrl(dataUrl);
        }
      } catch (error) {
        console.error('QRコード生成エラー:', error);
        if (!isCancelled) {
          setQrCodeDataUrl('');
        }
      } finally {
        if (!isCancelled) {
          setIsGenerating(false);
        }
      }
    };

    generateQRCode();

    // React 19: クリーンアップ関数をrefに保存
    cleanupRef.current = () => {
      isCancelled = true;
    };

    return () => {
      isCancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [cameraJoinUrl]);

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.download = `harecame-qr-${event.participationCode}.png`;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          参加用QRコード
        </CardTitle>
        <CardDescription>
          カメラオペレーターがスマホで簡単に参加できるQRコードです
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code Display */}
        <div className="flex justify-center">
          {isGenerating ? (
            <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <QrCode className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-muted-foreground">QRコード生成中...</p>
              </div>
            </div>
          ) : qrCodeDataUrl ? (
            <div className="p-4 bg-white rounded-lg border">
              <Image
                src={qrCodeDataUrl}
                alt={`${event.title}イベントの参加用QRコード - 参加コード: ${event.participationCode}`}
                width={256}
                height={256}
                className="w-64 h-64"
                unoptimized={true}
                priority={true}
              />
            </div>
          ) : (
            <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
              <p className="text-sm text-muted-foreground">QRコードの生成に失敗しました</p>
            </div>
          )}
        </div>

        {/* Event Information */}
        <div className="text-center space-y-2">
          <h3 className="font-semibold">{event.title}</h3>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="font-mono">
              {event.participationCode}
            </Badge>
            <Badge variant={event.status === 'live' ? 'default' : 'secondary'}>
              {event.status === 'live' ? 'ライブ中' :
               event.status === 'scheduled' ? '予定' : '終了'}
            </Badge>
          </div>
        </div>

        {/* URL Display */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            参加URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={cameraJoinUrl}
              readOnly
              className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(cameraJoinUrl)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={cameraJoinUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={downloadQRCode}
            disabled={!qrCodeDataUrl}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            QRコードをダウンロード
          </Button>
          <Button
            variant="outline"
            onClick={() => copyToClipboard(event.participationCode)}
            className="flex-1"
          >
            <Copy className="h-4 w-4 mr-2" />
            参加コードをコピー
          </Button>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">参加方法</h4>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. スマホでQRコードを読み取る</li>
            <li>2. 参加者名を入力（任意）</li>
            <li>3. 「カメラで参加」ボタンをタップ</li>
            <li>4. カメラとマイクの許可を与える</li>
            <li>5. 配信開始！</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
