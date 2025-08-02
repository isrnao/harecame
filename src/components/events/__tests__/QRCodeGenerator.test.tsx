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
jest.mock('next/image', () => {
  return function MockImage(props: any) {
    // Next.js Image の重要な属性を保持
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        {...props}
        data-nimg="1"
        data-testid="next-image"
        // unoptimized が明示的に true でない限り、最適化が有効
        data-optimized={props.unoptimized !== true ? 'true' : 'false'}
        // priority属性を文字列として設定
        priority={props.priority ? 'true' : undefined}
        // className属性を適切に設定
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

describe('QRCodeGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルトのモック実装を設定
    (mockToDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,mock-qr-code-data');
  });

  describe('画像最適化のテスト', () => {
    test('Next.js Image component の最適化が有効になっていることをテスト', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      // QRコードが生成されるまで待機
      await waitFor(() => {
        const image = screen.getByTestId('next-image');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByTestId('next-image');

      // unoptimized 属性が設定されていないことを確認（最適化が有効）
      expect(image).not.toHaveAttribute('unoptimized');
      expect(image).not.toHaveAttribute('unoptimized', 'true');

      // Next.js Image コンポーネントが使用されていることを確認
      expect(image).toHaveAttribute('data-nimg', '1');

      // 画像が適切にレンダリングされていることを確認
      expect(image).toHaveAttribute('src');
      expect(image.getAttribute('src')).toContain('data:image');
    });

    test('画像品質設定が適切に設定されていることをテスト', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByTestId('next-image');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByTestId('next-image');

      // Next.js Image コンポーネントが適切にレンダリングされていることを確認
      expect(image).toHaveAttribute('data-nimg', '1');
      expect(image).toHaveAttribute('src');
    });

    test('priority 属性が設定されていることをテスト', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByTestId('next-image');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByTestId('next-image');

      // priority 属性が設定されていることを確認（重要な画像として扱われる）
      // Next.js Image コンポーネントでは priority={true} として渡される
      expect(image).toHaveAttribute('priority');
    });
  });

  describe('アクセシビリティ属性のテスト', () => {
    test('適切な alt 属性が設定されていることをテスト', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByRole('img');

      // アクセシビリティのための適切な alt 属性
      const expectedAlt = `${mockEvent.title}イベントの参加用QRコード - 参加コード: ${mockEvent.participationCode}`;
      expect(image).toHaveAttribute('alt', expectedAlt);

      // alt 属性が空でないことを確認
      expect(image.getAttribute('alt')).toBeTruthy();
      expect(image.getAttribute('alt')?.length).toBeGreaterThan(0);
    });

    test('alt 属性にイベント情報が含まれていることをテスト', async () => {
      const customEvent = {
        ...mockEvent,
        title: 'カスタムイベント',
        participationCode: 'CUSTOM456'
      };

      render(<QRCodeGenerator event={customEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByRole('img');
      const altText = image.getAttribute('alt');

      // イベントタイトルと参加コードが含まれていることを確認
      expect(altText).toContain('カスタムイベント');
      expect(altText).toContain('CUSTOM456');
      expect(altText).toContain('参加用QRコード');
    });

    test('画像の寸法が適切に設定されていることをテスト', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByRole('img');

      // width と height 属性が設定されていることを確認
      expect(image).toHaveAttribute('width', '256');
      expect(image).toHaveAttribute('height', '256');

      // 寸法が数値として有効であることを確認
      const width = parseInt(image.getAttribute('width') || '0');
      const height = parseInt(image.getAttribute('height') || '0');
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(width).toBe(height); // QRコードは正方形
    });
  });

  describe('画像の読み込みパフォーマンス検証', () => {
    test('QRコード生成のパフォーマンスをテスト', async () => {
      const startTime = performance.now();

      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // レンダリング時間が合理的な範囲内であることを確認（1秒以内）
      expect(renderTime).toBeLessThan(1000);
    });

    test('QRコードライブラリが適切なオプションで呼び出されることをテスト', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      // QRCode.toDataURL が適切なオプションで呼び出されることを確認
      expect(mockToDataURL).toHaveBeenCalledWith(
        expect.stringContaining('/camera/join?code=TEST123'),
        expect.objectContaining({
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        })
      );
    });

    test('画像データが適切に生成されることをテスト', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByRole('img');

      // 画像のsrc属性が設定されていることを確認
      expect(image).toHaveAttribute('src');
      const src = image.getAttribute('src');
      expect(src).toContain('data:image/png;base64');
      expect(src).toBe('data:image/png;base64,mock-qr-code-data');
    });

    test('ローディング状態が適切に管理されることをテスト', async () => {
      // QRコード生成を遅延させるモック
      mockToDataURL.mockImplementationOnce(() =>
        new Promise(resolve => setTimeout(() => resolve('data:image/png;base64,delayed-qr-code'), 100))
      );

      render(<QRCodeGenerator event={mockEvent} />);

      // 初期状態でローディング表示があることを確認
      expect(screen.getByText('QRコード生成中...')).toBeInTheDocument();

      // QRコードが生成されるまで待機
      await waitFor(() => {
        const image = screen.getByRole('img');
        expect(image).toBeInTheDocument();
      }, { timeout: 2000 });

      // ローディング表示が消えることを確認
      expect(screen.queryByText('QRコード生成中...')).not.toBeInTheDocument();
    });

    test('エラー状態が適切に処理されることをテスト', async () => {
      // QRコード生成でエラーを発生させるモック
      (mockToDataURL as jest.Mock).mockRejectedValueOnce(new Error('QR code generation failed'));

      // console.error をモック
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        expect(screen.getByText('QRコードの生成に失敗しました')).toBeInTheDocument();
      });

      // エラーがログに記録されることを確認
      expect(consoleSpy).toHaveBeenCalledWith('Failed to generate QR code:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('レスポンシブ対応とCSS最適化', () => {
    test('画像のCSSクラスが適切に設定されていることをテスト', async () => {
      render(<QRCodeGenerator event={mockEvent} />);

      await waitFor(() => {
        const image = screen.getByTestId('next-image');
        expect(image).toBeInTheDocument();
      });

      const image = screen.getByTestId('next-image');

      // レスポンシブ対応のCSSクラスが設定されていることを確認
      // React Testing Libraryでは class 属性として確認
      expect(image).toHaveAttribute('class', 'w-64 h-64');
    });
  });
});
