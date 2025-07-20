'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QrCode, Download, Copy, ExternalLink } from 'lucide-react';
import type { EventClient } from '@/types';

interface QRCodeGeneratorProps {
  event: EventClient;
}

export function QRCodeGenerator({ event }: QRCodeGeneratorProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate camera join URL
  const cameraJoinUrl = `${window.location.origin}/camera/join?code=${event.participationCode}`;

  // Generate QR code
  useEffect(() => {
    const generateQRCode = async () => {
      setIsGenerating(true);
      try {
        const dataUrl = await QRCode.toDataURL(cameraJoinUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });
        setQrCodeDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      } finally {
        setIsGenerating(false);
      }
    };

    if (typeof window !== 'undefined') {
      generateQRCode();
    }
  }, [cameraJoinUrl]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Add toast notification
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

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
              <img
                src={qrCodeDataUrl}
                alt={`QR Code for ${event.title}`}
                className="w-64 h-64"
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