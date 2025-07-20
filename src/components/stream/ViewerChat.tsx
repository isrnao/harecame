'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { analyticsService } from '@/lib/analytics';
import { MessageCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface ViewerChatProps {
  videoId: string;
  eventTitle: string;
  isLive: boolean;
  eventId?: string;
  chatSettings?: {
    enabled: boolean;
    moderated: boolean;
    allowGuests: boolean;
  };
}

export function ViewerChat({ videoId, eventTitle, isLive, eventId, chatSettings }: ViewerChatProps) {
  const [chatVisible, setChatVisible] = useState(true);
  const [chatUrl, setChatUrl] = useState<string>('');

  useEffect(() => {
    if (videoId && isLive) {
      // YouTube Live Chat の埋め込みURL を生成
      const chatEmbedUrl = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}`;
      setChatUrl(chatEmbedUrl);
    }
  }, [videoId, isLive]);

  // チャット表示/非表示の切り替え時に分析を記録
  const handleChatToggle = (visible: boolean) => {
    setChatVisible(visible);
    
    if (eventId) {
      analyticsService.trackInteraction({
        eventId,
        action: visible ? 'chat_open' : 'chat_close',
        metadata: analyticsService.getDeviceInfo(),
      });
    }
  };

  // チャットが無効化されている場合
  if (chatSettings && !chatSettings.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>チャット</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>このイベントではチャット機能が無効になっています</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isLive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>チャット</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>配信が開始されるとチャットが利用できます</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!videoId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>チャット</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>チャットを読み込み中...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5" />
            <span>ライブチャット</span>
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
              🔴 LIVE
            </Badge>
            {chatSettings?.moderated && (
              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
                モデレート済み
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleChatToggle(!chatVisible)}
              className="flex items-center space-x-1"
            >
              {chatVisible ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  <span className="hidden sm:inline">非表示</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">表示</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')}
              className="flex items-center space-x-1"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">YouTube</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      {chatVisible && (
        <CardContent className="p-0">
          <div className="h-80 sm:h-96 lg:h-80">
            <iframe
              src={chatUrl}
              title={`${eventTitle} - ライブチャット`}
              className="w-full h-full border-0 rounded-b-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        </CardContent>
      )}
      {!chatVisible && (
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>チャットが非表示になっています</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleChatToggle(true)}
              className="mt-2"
            >
              チャットを表示
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}