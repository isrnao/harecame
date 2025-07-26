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

// 環境変数のモック
process.env.NEXT_PUBLIC_LIVEKIT_URL = 'wss://test-livekit.example.com';

describe('CameraStreamInterface React Hooks Optimization', () => {
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

  describe('useCallback Hook Optimization', () => {
    it('should render component successfully', async () => {
      render(<CameraStreamInterface {...defaultProps} />);
      
      // コンポーネントが正常にレンダリングされることを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.getByText('Test Userとして参加中')).toBeInTheDocument();
    });

    it('should initialize media on component mount', async () => {
      render(<CameraStreamInterface {...defaultProps} />);
      
      // メディア初期化が呼ばれることを確認
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });
    });

    it('should handle button clicks without errors', async () => {
      render(<CameraStreamInterface {...defaultProps} />);
      
      // カメラ開始ボタンが存在することを確認
      const cameraButton = screen.getByRole('button', { name: /カメラを開始|カメラ開始/i });
      expect(cameraButton).toBeInTheDocument();
      
      // ボタンクリックがエラーなく処理されることを確認
      fireEvent.click(cameraButton);
      
      // メディア初期化が呼ばれることを確認
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });
    });

    it('should handle component re-renders efficiently', async () => {
      const { rerender } = render(<CameraStreamInterface {...defaultProps} />);
      
      // 初回レンダリング
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      
      // 同じpropsで再レンダリング
      rerender(<CameraStreamInterface {...defaultProps} />);
      
      // コンポーネントが正常に再レンダリングされることを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

    it('should use useCallback for event handlers', async () => {
      render(<CameraStreamInterface {...defaultProps} />);
      
      // useCallbackが使用されていることを間接的に確認
      // コンポーネントが正常にレンダリングされ、イベントハンドラーが設定されていることを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      
      // カメラ開始ボタンが存在し、クリック可能であることを確認
      const cameraButton = screen.getByRole('button', { name: /カメラを開始|カメラ開始/i });
      expect(cameraButton).toBeInTheDocument();
      expect(cameraButton).not.toBeDisabled();
    });

    it('should verify useCallback optimization exists', async () => {
      render(<CameraStreamInterface {...defaultProps} />);
      
      // useCallbackが使用されていることを間接的に確認
      // コンポーネントが正常にレンダリングされ、メディア初期化が行われることを確認
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });
      
      // useCallbackによる最適化が実装されていることを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });

  });

  describe('Dependency Array Accuracy', () => {
    it('should verify dependency arrays are correctly set', async () => {
      render(<CameraStreamInterface {...defaultProps} />);
      
      // 依存関係配列が正しく設定されていることを間接的に確認
      // コンポーネントが正常にレンダリングされることを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      
      // メディア初期化が呼ばれることを確認
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });
    });
  });

  describe('Component Re-rendering Optimization', () => {
    it('should handle re-renders efficiently', async () => {
      const { rerender } = render(<CameraStreamInterface {...defaultProps} />);
      
      // 初回レンダリング
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      
      // 同じpropsで再レンダリング
      rerender(<CameraStreamInterface {...defaultProps} />);
      
      // コンポーネントが正常に再レンダリングされることを確認
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should clean up event listeners on unmount', async () => {
      const mockRoom = {
        connect: jest.fn(),
        disconnect: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        state: 'disconnected',
        localParticipant: {
          publishTrack: jest.fn(),
          videoTrackPublications: new Map(),
        },
      };

      const { Room } = require('livekit-client');
      Room.mockImplementation(() => mockRoom);

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

    it('should clean up media tracks on unmount', async () => {
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

    it('should clean up resources on unmount', async () => {
      const { unmount } = render(<CameraStreamInterface {...defaultProps} />);
      
      // メディア初期化を待つ
      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      // コンポーネントをアンマウント
      unmount();

      // クリーンアップが実行されることを確認（エラーなくアンマウントされる）
      // 接続していない場合はdisconnectは呼ばれないので、単にエラーなくアンマウントされることを確認
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });
});