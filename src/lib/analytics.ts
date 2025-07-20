// 視聴者インタラクション分析機能
// React 19の after() APIを使用して非ブロッキングで実行

export interface ViewerInteraction {
  eventId: string;
  action: 'view_start' | 'view_end' | 'chat_open' | 'chat_close' | 'fullscreen' | 'quality_change';
  timestamp: Date;
  metadata?: {
    duration?: number;
    quality?: string;
    userAgent?: string;
    screenSize?: string;
  };
}

export interface ViewerAnalytics {
  eventId: string;
  totalViewers: number;
  peakViewers: number;
  averageViewDuration: number;
  chatEngagement: number;
  qualityDistribution: Record<string, number>;
  deviceTypes: Record<string, number>;
}

class AnalyticsService {
  private interactions: ViewerInteraction[] = [];
  private viewStartTimes: Map<string, Date> = new Map();

  // 視聴者インタラクションを記録
  trackInteraction(interaction: Omit<ViewerInteraction, 'timestamp'>) {
    const fullInteraction: ViewerInteraction = {
      ...interaction,
      timestamp: new Date(),
    };

    this.interactions.push(fullInteraction);

    // 視聴開始時刻を記録
    if (interaction.action === 'view_start') {
      this.viewStartTimes.set(interaction.eventId, new Date());
    }

    // 視聴終了時に継続時間を計算
    if (interaction.action === 'view_end') {
      const startTime = this.viewStartTimes.get(interaction.eventId);
      if (startTime) {
        const duration = Date.now() - startTime.getTime();
        fullInteraction.metadata = {
          ...fullInteraction.metadata,
          duration,
        };
        this.viewStartTimes.delete(interaction.eventId);
      }
    }

    // 非ブロッキングでサーバーに送信（React 19 after() API使用想定）
    this.sendToServer(fullInteraction);
  }

  // デバイス情報を取得
  getDeviceInfo() {
    const userAgent = navigator.userAgent;
    const screenSize = `${screen.width}x${screen.height}`;
    
    let deviceType = 'desktop';
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
    }

    return {
      userAgent,
      screenSize,
      deviceType,
    };
  }

  // 視聴品質を検出
  detectVideoQuality(): string {
    // YouTube埋め込みプレーヤーから品質情報を取得する場合の実装
    // 実際の実装では、YouTube Player APIを使用して品質情報を取得
    return 'auto'; // デフォルト値
  }

  // サーバーに分析データを送信（非ブロッキング）
  private async sendToServer(interaction: ViewerInteraction) {
    try {
      // 実際の実装では、after() APIを使用して非ブロッキングで実行
      await fetch('/api/analytics/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(interaction),
      });
    } catch (error) {
      // エラーは静かに処理（分析データの送信失敗はユーザー体験に影響しない）
      console.debug('Analytics tracking failed:', error);
    }
  }

  // イベントの分析データを取得
  async getEventAnalytics(eventId: string): Promise<ViewerAnalytics | null> {
    try {
      const response = await fetch(`/api/analytics/events/${eventId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
    return null;
  }

  // 現在の視聴セッションをクリーンアップ
  cleanup(eventId: string) {
    this.viewStartTimes.delete(eventId);
    // 視聴終了を記録
    this.trackInteraction({
      eventId,
      action: 'view_end',
      metadata: this.getDeviceInfo(),
    });
  }
}

export const analyticsService = new AnalyticsService();