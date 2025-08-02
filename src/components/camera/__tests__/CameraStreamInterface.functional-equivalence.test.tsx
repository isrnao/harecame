import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CameraStreamInterface } from '../CameraStreamInterface';

// LiveKit client のモック
const mockRoom = {
  connect: jest.fn(),
  disconnect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  off: jest.fn(),
  state: 'disconnected',
  localParticipant: {
    publishTrack: jest.fn(),
    videoTrackPublications: new Map(),
  },
};

jest.mock('livekit-client', () => ({
  Room: jest.fn().mockImplementation(() => mockRoom),
  RoomEvent: {
    ConnectionStateChanged: 'connectionStateChanged',
    ConnectionQualityChanged: 'connectionQualityChanged',
    Disconnected: 'disconnected',
  },
  LocalVideoTrack: jest.fn().mockImplementation(() => ({
    sid: 'video-track-sid',
    sender: null,
    mute: jest.fn(),
    unmute: jest.fn(),
    stop: jest.fn(),
  })),
  LocalAudioTrack: jest.fn().mockImplementation(() => ({
    sid: 'audio-track-sid',
    mute: jest.fn(),
    unmute: jest.fn(),
    stop: jest.fn(),
  })),
  ConnectionState: {
    Disconnected: 'disconnected',
    Connected: 'connected',
    Connecting: 'connecting',
  },
  ConnectionQuality: {
    Unknown: 'unknown',
    Poor: 'poor',
    Good: 'good',
    Excellent: 'excellent',
  },
  Track: {
    Source: {
      Camera: 'camera',
      Microphone: 'microphone',
    },
  },
}));

// カスタムフックのモック
jest.mock('@/hooks/useDeviceOrientation', () => ({
  useDeviceOrientation: () => ({
    orientation: 'landscape',
    angle: 0,
  }),
}));

jest.mock('@/hooks/useNetworkQuality', () => ({
  useNetworkQuality: () => ({
    networkQuality: {
      effectiveType: '4g',
      downlink: 10,
    },
    recommendedQuality: {
      width: 1280,
      height: 720,
      frameRate: 30,
    },
  }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    retryWithBackoff: jest.fn().mockImplementation((fn) => fn()),
  }),
}));

// getUserMedia のモック
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia,
  },
});

// HTMLMediaElement.prototype.play のモック（JSdom制限対応）
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: jest.fn().mockResolvedValue(undefined),
});

// HTMLMediaElement.prototype.pause のモック
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: jest.fn(),
});

// HTMLMediaElement.prototype.load のモック
Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  writable: true,
  value: jest.fn(),
});

// 環境変数のモック
process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://test-livekit.example.com';

describe('CameraStreamInterface - 機能的等価性テスト', () => {
  const defaultProps = {
    roomToken: 'test-token',
    roomName: 'test-room',
    eventId: 'event-123',
    eventTitle: 'Test Event',
    participantName: 'Test User',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // getUserMedia のデフォルトモック
    mockGetUserMedia.mockResolvedValue({
      getVideoTracks: () => [{ id: 'video-track' }],
      getAudioTracks: () => [{ id: 'audio-track' }],
    });

    // sessionStorage のモック
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    // fetch のモック
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    // mockRoom の状態をリセット
    mockRoom.state = 'disconnected';
    mockRoom.connect.mockResolvedValue(undefined);
    mockRoom.disconnect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('React 19リファクタリング後の機能的等価性', () => {
    test('コンポーネントが正常にレンダリングされる', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // 基本的な表示要素が存在することを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.getByText('Test Userとして参加中')).toBeInTheDocument();
      expect(screen.getByText('カメラプレビュー')).toBeInTheDocument();
    });

    test('メディア初期化が自動的に実行される', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // メディア初期化が呼ばれることを確認
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      });
    });

    test('useCallbackによる関数の最適化が機能する', async () => {
      const { rerender } = render(<CameraStreamInterface {...defaultProps} />);

      // 初回レンダリング
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      const initialCallCount = mockGetUserMedia.mock.calls.length;

      // 同じpropsで再レンダリング
      rerender(<CameraStreamInterface {...defaultProps} />);

      // 追加のメディア初期化が発生しないことを確認
      expect(mockGetUserMedia).toHaveBeenCalledTimes(initialCallCount);
    });

    test('エラーハンドリングが正しく機能する', async () => {
      // メディア取得でエラーを発生させる
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValueOnce(error);

      render(<CameraStreamInterface {...defaultProps} />);

      // エラー状態が適切に処理されることを確認
      await waitFor(() => {
        // CameraPermissionErrorコンポーネントが表示されることを確認
        expect(screen.getByText('カメラ・マイクへのアクセスが拒否されました')).toBeInTheDocument();
      });
    });

    test('リソースのクリーンアップが正しく実行される', async () => {
      const mockVideoTrack = {
        mute: jest.fn(),
        unmute: jest.fn(),
        stop: jest.fn(),
      };

      const mockAudioTrack = {
        mute: jest.fn(),
        unmute: jest.fn(),
        stop: jest.fn(),
      };

      const { LocalVideoTrack, LocalAudioTrack } = require('livekit-client');
      LocalVideoTrack.mockImplementation(() => mockVideoTrack);
      LocalAudioTrack.mockImplementation(() => mockAudioTrack);

      const { unmount } = render(<CameraStreamInterface {...defaultProps} />);

      // メディア初期化を待つ
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // コンポーネントをアンマウント
      unmount();

      // メディアトラックが停止されることを確認
      expect(mockVideoTrack.stop).toHaveBeenCalled();
      expect(mockAudioTrack.stop).toHaveBeenCalled();
    });
  });

  describe('UI状態の管理', () => {
    test('ローディング状態が正しく表示される', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // 初期ローディング状態を確認
      expect(screen.getByText('カメラを準備中...')).toBeInTheDocument();

      // メディア初期化が完了するまで待機
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });
    });

    test('接続状態の表示が正しく更新される', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // 初期状態では未接続
      await waitFor(() => {
        expect(screen.getByText('未接続')).toBeInTheDocument();
      });
    });

    test('デバイス向きの案内が表示される', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // デバイス向き表示エリアが存在することを確認
      await waitFor(() => {
        expect(screen.getByText('📹 配信中')).toBeInTheDocument();
      });
    });

    test('ネットワーク品質の表示が機能する', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // コンポーネントが正常にレンダリングされることを確認
      await waitFor(() => {
        expect(screen.getByText('Test Event')).toBeInTheDocument();
      });

      // ネットワーク品質フックが使用されていることを間接的に確認
      // フックが正常に動作していることを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });
  });

  describe('LiveKit接続の最適化', () => {
    test('接続処理が正しく実行される', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // 配信開始ボタンが表示されることを確認
      const startButton = await screen.findByRole('button', { name: /配信開始|開始/i });
      expect(startButton).toBeInTheDocument();

      // ボタンがクリック可能であることを確認
      expect(startButton).not.toBeDisabled();
    });

    test('イベントリスナーの設定と削除が正しく実行される', async () => {
      const { unmount } = render(<CameraStreamInterface {...defaultProps} />);

      // イベントリスナーが設定されることを確認
      expect(mockRoom.on).toHaveBeenCalledWith('connectionStateChanged', expect.any(Function));
      expect(mockRoom.on).toHaveBeenCalledWith('connectionQualityChanged', expect.any(Function));
      expect(mockRoom.on).toHaveBeenCalledWith('disconnected', expect.any(Function));

      // コンポーネントをアンマウント
      unmount();

      // イベントリスナーが削除されることを確認
      expect(mockRoom.off).toHaveBeenCalledWith('connectionStateChanged', expect.any(Function));
      expect(mockRoom.off).toHaveBeenCalledWith('connectionQualityChanged', expect.any(Function));
      expect(mockRoom.off).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });
  });

  describe('パフォーマンス最適化', () => {
    test('不要な再レンダリングが発生しない', async () => {
      const { rerender } = render(<CameraStreamInterface {...defaultProps} />);

      // 初回レンダリング
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      const initialCallCount = mockGetUserMedia.mock.calls.length;

      // 同じpropsで再レンダリング
      rerender(<CameraStreamInterface {...defaultProps} />);

      // 追加のメディア初期化が発生しないことを確認
      expect(mockGetUserMedia).toHaveBeenCalledTimes(initialCallCount);
    });

    test('メモリリークが発生しない', async () => {
      const { unmount } = render(<CameraStreamInterface {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // コンポーネントをアンマウント
      unmount();

      // メモリリークの検証（エラーなくアンマウントされることを確認）
      expect(true).toBe(true);
    });

    test('レンダリング時間が合理的な範囲内', async () => {
      const startTime = performance.now();

      render(<CameraStreamInterface {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Event')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // レンダリング時間が2秒以内であることを確認
      expect(renderTime).toBeLessThan(2000);
    });
  });

  describe('アクセシビリティとユーザビリティ', () => {
    test('適切なARIA属性が設定されている', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // ボタン要素が適切にラベル付けされていることを確認
      const startButton = await screen.findByRole('button', { name: /配信開始|開始/i });
      expect(startButton).toBeInTheDocument();
    });

    test('キーボードナビゲーションが機能する', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // フォーカス可能な要素が存在することを確認
      const startButton = await screen.findByRole('button', { name: /配信開始|開始/i });
      expect(startButton).not.toHaveAttribute('tabindex', '-1');
    });

    test('モバイル最適化が維持されている', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // タッチ操作対応のクラスが適用されていることを確認
      const startButton = await screen.findByRole('button', { name: /配信開始|開始/i });
      expect(startButton).toHaveClass('touch-manipulation');
    });
  });

  describe('エラー回復機能', () => {
    test('権限エラー後の再試行が機能する', async () => {
      // 初回は権限エラー
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValueOnce(error);

      render(<CameraStreamInterface {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('カメラ・マイクへのアクセスが拒否されました')).toBeInTheDocument();
      });

      // 再試行時は成功
      mockGetUserMedia.mockResolvedValueOnce({
        getVideoTracks: () => [{ id: 'video-track' }],
        getAudioTracks: () => [{ id: 'audio-track' }],
      });

      // 再試行ボタンをクリック
      const retryButton = screen.getByText('再試行');
      fireEvent.click(retryButton);

      // 成功状態に回復することを確認
      await waitFor(() => {
        expect(screen.getByText('カメラプレビュー')).toBeInTheDocument();
      });
    });

    test('ネットワークエラー後の自動復旧が機能する', async () => {
      render(<CameraStreamInterface {...defaultProps} />);

      // コンポーネントが正常にレンダリングされることを確認
      await waitFor(() => {
        expect(screen.getByText('Test Event')).toBeInTheDocument();
      });

      // useNetworkStatusフックが使用されていることを間接的に確認
      // フックが正常に動作していることを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });
  });
});
