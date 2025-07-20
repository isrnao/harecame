'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Mic, 
  AlertTriangle, 
  RefreshCw, 
  Settings, 
  Smartphone,
  Monitor,
  Chrome
} from 'lucide-react';

interface CameraPermissionErrorProps {
  error: Error;
  onRetry: () => void;
  onSkip?: () => void;
}

export function CameraPermissionError({ error, onRetry, onSkip }: CameraPermissionErrorProps) {
  const [browserInfo, setBrowserInfo] = useState({
    name: 'unknown',
    platform: 'unknown',
  });

  useEffect(() => {
    const userAgent = navigator.userAgent;
    let browserName = 'unknown';
    let platform = 'unknown';

    // ブラウザ検出
    if (/Chrome/i.test(userAgent)) browserName = 'chrome';
    else if (/Firefox/i.test(userAgent)) browserName = 'firefox';
    else if (/Safari/i.test(userAgent)) browserName = 'safari';
    else if (/Edge/i.test(userAgent)) browserName = 'edge';

    // プラットフォーム検出
    if (/iPhone|iPad|iPod/i.test(userAgent)) platform = 'ios';
    else if (/Android/i.test(userAgent)) platform = 'android';
    else if (/Mac/i.test(userAgent)) platform = 'mac';
    else if (/Win/i.test(userAgent)) platform = 'windows';

    setBrowserInfo({ name: browserName, platform });
  }, []);

  const getBrowserIcon = () => {
    switch (browserInfo.name) {
      case 'chrome': return <Chrome className="h-4 w-4" />;
      case 'firefox': return <Monitor className="h-4 w-4" />;
      case 'safari': return <Monitor className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getPlatformIcon = () => {
    return ['ios', 'android'].includes(browserInfo.platform) ? 
      <Smartphone className="h-4 w-4" /> : 
      <Monitor className="h-4 w-4" />;
  };

  const getErrorType = () => {
    if (error.name === 'NotAllowedError') {
      return {
        type: 'permission_denied',
        title: 'カメラ・マイクへのアクセスが拒否されました',
        description: 'ライブ配信に参加するには、カメラとマイクの使用を許可してください。',
      };
    } else if (error.name === 'NotFoundError') {
      return {
        type: 'device_not_found',
        title: 'カメラまたはマイクが見つかりません',
        description: 'デバイスが正しく接続されているか確認してください。',
      };
    } else if (error.name === 'NotReadableError') {
      return {
        type: 'device_in_use',
        title: 'カメラまたはマイクが使用中です',
        description: '他のアプリケーションでカメラやマイクが使用されている可能性があります。',
      };
    } else {
      return {
        type: 'unknown',
        title: 'メディアデバイスエラー',
        description: 'カメラまたはマイクの初期化に失敗しました。',
      };
    }
  };

  const errorInfo = getErrorType();

  const getInstructions = () => {
    const { name: browser, platform } = browserInfo;

    if (errorInfo.type === 'permission_denied') {
      // ブラウザ・プラットフォーム別の権限設定手順
      if (browser === 'chrome') {
        if (platform === 'android' || platform === 'ios') {
          return [
            'アドレスバーの左側にあるカメラアイコンをタップ',
            '「カメラ」と「マイク」を「許可」に設定',
            'ページを再読み込みして再試行',
          ];
        } else {
          return [
            'アドレスバーの左側にあるカメラアイコンをクリック',
            '「カメラ」と「マイク」を「許可」に設定',
            'ページを再読み込みして再試行',
          ];
        }
      } else if (browser === 'safari') {
        if (platform === 'ios') {
          return [
            'Safari設定 > プライバシーとセキュリティ > カメラ',
            'このサイトに「許可」を設定',
            'マイクについても同様に設定',
            'ページを再読み込みして再試行',
          ];
        } else {
          return [
            'Safari > 環境設定 > Webサイト > カメラ',
            'このサイトに「許可」を設定',
            'マイクについても同様に設定',
            'ページを再読み込みして再試行',
          ];
        }
      } else if (browser === 'firefox') {
        return [
          'アドレスバーの左側にあるシールドアイコンをクリック',
          '「カメラとマイクロフォンをブロック」を解除',
          'ページを再読み込みして再試行',
        ];
      }
    } else if (errorInfo.type === 'device_not_found') {
      return [
        'カメラとマイクが正しく接続されているか確認',
        '他のアプリケーションでデバイスが使用されていないか確認',
        'デバイスドライバーが最新であることを確認',
      ];
    } else if (errorInfo.type === 'device_in_use') {
      return [
        '他のブラウザタブやアプリケーションを閉じる',
        'ビデオ通話アプリ（Zoom、Teams等）を終了',
        'デバイスを再接続してみる',
      ];
    }

    return [
      'ブラウザを最新版に更新',
      'ページを再読み込み',
      '別のブラウザで試す',
    ];
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-orange-600" />
        </div>
        <CardTitle className="text-xl text-orange-900">
          {errorInfo.title}
        </CardTitle>
        <CardDescription>
          {errorInfo.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* デバイス情報 */}
        <div className="flex items-center justify-center gap-4">
          <Badge variant="outline" className="flex items-center gap-2">
            {getPlatformIcon()}
            <span className="capitalize">{browserInfo.platform}</span>
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            {getBrowserIcon()}
            <span className="capitalize">{browserInfo.name}</span>
          </Badge>
        </div>

        {/* 必要な権限 */}
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">必要な権限:</div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-blue-600" />
                <span className="text-sm">カメラ</span>
              </div>
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-green-600" />
                <span className="text-sm">マイク</span>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* 解決手順 */}
        <div>
          <h3 className="font-medium mb-3">解決手順:</h3>
          <ol className="space-y-2">
            {getInstructions().map((instruction, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="text-sm">{instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* エラー詳細（開発環境のみ） */}
        {process.env.NODE_ENV === 'development' && (
          <Alert>
            <AlertDescription className="text-xs font-mono">
              <details>
                <summary className="cursor-pointer mb-2">
                  エラー詳細（開発用）
                </summary>
                <div className="whitespace-pre-wrap break-all">
                  {error.name}: {error.message}
                </div>
              </details>
            </AlertDescription>
          </Alert>
        )}

        {/* アクションボタン */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={onRetry} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            再試行
          </Button>
          {onSkip && (
            <Button onClick={onSkip} variant="outline" className="flex-1">
              スキップ
            </Button>
          )}
        </div>

        {/* 追加のヘルプ */}
        <div className="text-center text-sm text-muted-foreground">
          <p>問題が解決しない場合は、ブラウザの設定を確認するか、</p>
          <p>別のデバイスやブラウザでお試しください。</p>
        </div>
      </CardContent>
    </Card>
  );
}