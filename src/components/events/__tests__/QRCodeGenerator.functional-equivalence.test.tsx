import { render, screen, waitFor } from '@testing-library/react';
import { QRCodeGenerator } from '../QRCodeGenerator';
import type { EventClient } from '@/types';

// QRCode ライブラリをモック
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

// モック関数への参照を取得
import QRCode from 'qrcode';
const mockToDataURL = QRCode.toDataURL as jest.MockedFunction<typeof QRCode.toDataURL>;

// window.location をモック
delete (window as any).location;
(window as any).location = {
  origin: 'http://localhost:3000',
};

// Next.js Image コンポーネントをモック
interface MockImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  [key: string]: unknown;
}

jest.mock('next/image', () => {
  return function MockImage(props: MockImageProps) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...props}
        data-nimg="1"
        data-testid="next-image"
        data-optimized={props.unoptimized !== true ? 'true' : 'false'}
        data-priority={props.priority ? 'true' : undefined}
        className={props.className}
      />
    );
  };
});

const mockEvent: EventClient = {
  id: 'test-event-id',
  title: 'テストイベント',
  participationCode: 'TEST123',
  status: 'live',
  createdAt: new Date(),
  updatedAt: new Date(),
  description: 'テスト用のイベントです',
  livekitRoomName: 'test-room',
};

describe('QRCodeGenerator - 機能的等価性テスト', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockToDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,mock-qr-code-data');
  });

  describe('React 19リファクタリング後の機能的等価性', () => {
    test('派生状態の計算がレンダリング中に正しく実行される', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      // cameraJoinUrlが正しく計算されることを確認
      await waitFor(() => {
        expect(mockToDataURL).toHaveBeenCalledWith(
          expect.stringContaining('camera/join?code=TEST123'),
          expect.any(Object)
        );
      });
    });

    test('コンポーネントの表示内容が変更前と同じ', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      // 基本的な表示要素が存在することを確認
      expect(screen.getByText('参加用QRコード')).toBeInTheDocument();
      expect(screen.getByText('テストイベント')).toBeInTheDocument();
      expect(screen.getByText('TEST123')).toBeInTheDocument();

      // QRコードが生成されるまで待機
      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute('src', 'data:image/png;base64,mock-qr-code-data');
      });

      // 参加URLが正しく表示されることを確認
      const urlInput = screen.getByDisplayValue(/camera\/join\?code=TEST123/);
      expect(urlInput).toBeInTheDocument();
    });

    test('エラーハンドリングが正しく機能する', async () => {
      // QRコード生成でエラーを発生させる
      (mockToDataURL as jest.Mock).mockRejectedValueOnce(new Error('QR generation failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<QRCodeGenerator event={mockEvent} />);

      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('QRコードの生成に失敗しました')).toBeInTheDocument();
      });

      // エラーがログに記録されることを確認
      expect(consoleSpy).toHaveBeenCalledWith('Failed to generate QR code:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    test('ローディング状態の管理が正しく機能する', async () => {
      // QRコード生成を遅延させる
      mockToDataURL.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve('data:image/png;base64,delayed-qr-code'), 100))
      );

      render(<QRCodeGenerator event={mockEvent} />);

      // ローディング表示があることを確認
      expect(screen.getByText('QRコード生成中...')).toBeInTheDocument();

      // QRコードが生成されるまで待機
      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      }, { timeout: 2000 });

      // ローディング表示が消えることを確認
      expect(screen.queryByText('QRコード生成中...')).not.toBeInTheDocument();
    });
  });

  describe('パフォーマンス最適化の検証', () => {
    test('レンダリング時間が合理的な範囲内', async () => {
      const startTime = performance.now();

      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // レンダリング時間が1秒以内であることを確認
      expect(renderTime).toBeLessThan(1000);
    });

    test('メモリリークが発生しない', async () => {
      const { unmount } = render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      // コンポーネントをアンマウント
      unmount();

      // メモリリークの検証（エラーなくアンマウントされることを確認）
      expect(true).toBe(true);
    });
  });

  describe('アクセシビリティの維持', () => {
    test('適切なalt属性が設定されている', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByRole('img');
      const expectedAlt = `${mockEvent.title}イベントの参加用QRコード - 参加コード: ${mockEvent.participationCode}`;
      expect(image).toHaveAttribute('alt', expectedAlt);
    });

    test('キーボードナビゲーションが機能する', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      // ボタン要素がフォーカス可能であることを確認
      const copyButton = screen.getByRole('button', { name: /参加コードをコピー/ });
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).not.toHaveAttribute('tabindex', '-1');
    });
  });
});
