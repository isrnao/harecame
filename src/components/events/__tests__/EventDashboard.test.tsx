import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EventDashboard } from '../EventDashboard';
import type { EventClient } from '@/types';

// モックデータ
const mockEvent: EventClient = {
  id: 'test-event-1',
  title: 'テストイベント',
  description: 'テスト用のイベントです',
  status: 'live',
  participationCode: 'ABC123',
  youtubeStreamUrl: 'https://youtube.com/watch?v=test',
  youtubeVideoId: 'test-video-id',
  livekitRoomName: 'test-room',
  scheduledAt: new Date('2025-07-20T10:00:00Z'),
  createdAt: new Date('2025-07-19T10:00:00Z'),
  updatedAt: new Date('2025-07-19T10:00:00Z'),
};

// モック関数
const mockFetch = jest.fn();
global.fetch = mockFetch;

// YouTube APIのモック
jest.mock('@/lib/youtube', () => ({
  getYouTubeStreamStats: jest.fn().mockResolvedValue({
    viewerCount: 100,
    duration: '01:30:00',
  }),
}));

describe('EventDashboard', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // デフォルトのレスポンスを設定
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/cameras')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { id: 'camera-1', status: 'active', name: 'カメラ1' },
              { id: 'camera-2', status: 'inactive', name: 'カメラ2' },
            ],
          }),
        });
      }
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              isLive: true,
              streamHealth: 'excellent',
              youtubeViewerCount: 150,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
      });
    });
  });

  it('should render event dashboard with initial data', async () => {
    render(<EventDashboard event={mockEvent} />);
    
    expect(screen.getByText('テストイベント')).toBeInTheDocument();
    expect(screen.getByText('イベントダッシュボード')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('should show loading state when refreshing data', async () => {
    render(<EventDashboard event={mockEvent} />);
    
    const refreshButtons = screen.getAllByRole('button', { name: /更新/ });
    const refreshButton = refreshButtons[0]; // 最初の更新ボタンを使用
    
    // 更新ボタンをクリック
    fireEvent.click(refreshButton);
    
    // ローディング状態を確認
    expect(refreshButton).toBeDisabled();
    expect(screen.getAllByText(/更新中/)[0]).toBeInTheDocument();
    
    // ローディングが完了するまで待機
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it('should prevent duplicate refresh requests', async () => {
    render(<EventDashboard event={mockEvent} />);
    
    const refreshButtons = screen.getAllByRole('button', { name: /更新/ });
    const refreshButton = refreshButtons[0]; // 最初の更新ボタンを使用
    
    // 連続でクリック
    fireEvent.click(refreshButton);
    fireEvent.click(refreshButton);
    fireEvent.click(refreshButton);
    
    // 初回データ取得 + 手動更新1回のみが実行されることを確認
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(4); // 初回: cameras + status, 手動更新: cameras + status
    });
  });

  it('should handle API errors gracefully', async () => {
    // エラーレスポンスを設定（fetchが失敗するようにする）
    mockFetch.mockImplementation(() => 
      Promise.reject(new Error('Network error'))
    );

    render(<EventDashboard event={mockEvent} />);
    
    const refreshButtons = screen.getAllByRole('button', { name: /更新/ });
    const refreshButton = refreshButtons[0]; // 最初の更新ボタンを使用
    fireEvent.click(refreshButton);
    
    // エラーメッセージが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText(/データの取得に失敗しました/)).toBeInTheDocument();
    });
    
    // ローディング状態が適切にリセットされることを確認
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it('should display camera and viewer statistics', async () => {
    render(<EventDashboard event={mockEvent} />);
    
    // 初回データ取得が完了するまで待機
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument(); // アクティブカメラ数
      expect(screen.getByText('全2台中')).toBeInTheDocument(); // 総カメラ数
    });
  });

  it('should auto-refresh data periodically', async () => {
    jest.useFakeTimers();
    
    try {
      render(<EventDashboard event={mockEvent} />);
      
      // 初回データ取得が完了するまで待機
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
      
      mockFetch.mockClear();
      
      // 30秒後に自動更新をトリガー
      jest.advanceTimersByTime(30000);
      
      // タイマーによる非同期処理を実行
      await jest.runOnlyPendingTimersAsync();
      
      // 自動更新が実行されたことを確認（少なくとも1回は実行される）
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/events/test-event-1/cameras'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/events/test-event-1/status'),
        expect.any(Object)
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
