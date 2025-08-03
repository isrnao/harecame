/**
 * 型ガード関数とブラウザAPI用の安全な型定義
 * React 19とTypeScript 5.8+の最新機能を活用
 */

// 基本的な型ガード関数
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ブラウザAPI用の型定義
export interface NetworkConnection {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnection;
  mozConnection?: NetworkConnection;
  webkitConnection?: NetworkConnection;
}

export interface WindowWithOrientation {
  orientation?: number;
}

export interface ScreenWithOrientation {
  orientation?: {
    type: string;
    angle: number;
  };
}

export interface WindowWithCleanup extends Window {
  harecameCleanup?: {
    connection: () => void;
    stream: () => void;
  };
}

// 型ガード関数：ネットワーク接続情報
export function hasNetworkConnection(navigator: Navigator): navigator is NavigatorWithConnection {
  return 'connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator;
}

export function isNetworkConnection(value: unknown): value is NetworkConnection {
  return isObject(value) && (
    'effectiveType' in value ||
    'downlink' in value ||
    'rtt' in value ||
    'saveData' in value
  );
}

// 型ガード関数：デバイス向き
export function hasWindowOrientation(obj: unknown): obj is WindowWithOrientation {
  return typeof obj === 'object' && obj !== null && 'orientation' in obj;
}

export function hasScreenOrientation(obj: unknown): obj is ScreenWithOrientation {
  return typeof obj === 'object' && obj !== null && 'orientation' in obj;
}

// 型ガード関数：クリーンアップ機能
export function hasCleanupFunction(window: Window): window is WindowWithCleanup {
  return 'harecameCleanup' in window;
}

// エラー情報の型定義
export interface ErrorInfo {
  componentStack?: string;
  errorBoundary?: {
    constructor: {
      name: string;
    };
  };
  errorBoundaryStack?: string;
}

export function isErrorInfo(value: unknown): value is ErrorInfo {
  return isObject(value) && (
    'componentStack' in value ||
    'errorBoundary' in value ||
    'errorBoundaryStack' in value
  );
}

// JWT ペイロードの型定義
export interface JWTPayload {
  sub?: string;
  name?: string;
  room?: string;
  exp: number;
  iat: number;
  mockImplementation?: boolean;
  warning?: string;
  [key: string]: unknown;
}

export function isJWTPayload(value: unknown): value is JWTPayload {
  return isObject(value);
}

// HTML要素の型ガード関数（useFocusManagement用）
export interface SelectableElement extends HTMLElement {
  select(): void;
}

export function isSelectableElement(element: HTMLElement): element is SelectableElement {
  return 'select' in element && typeof (element as { select?: unknown }).select === 'function';
}

export function isInputElement(element: HTMLElement): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

export function isTextAreaElement(element: HTMLElement): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement;
}

export function isSelectableInputElement(element: HTMLElement): element is HTMLInputElement | HTMLTextAreaElement {
  return isInputElement(element) || isTextAreaElement(element);
}

// Video要素のスタイル型定義
export interface VideoStyleProps {
  transform?: string;
  WebkitTransform?: string;
  [key: string]: unknown;
}

export function isVideoStyleProps(value: unknown): value is VideoStyleProps {
  return isObject(value);
}

export function hasTransformStyle(style: unknown): style is { transform?: string; WebkitTransform?: string } {
  return isObject(style);
}

// ネットワーク接続の詳細型定義
export interface NetworkConnectionWithEvents {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (event: string, handler: () => void) => void;
}

export function isNetworkConnectionWithEvents(value: unknown): value is NetworkConnectionWithEvents {
  return isObject(value) && (
    'effectiveType' in value ||
    'downlink' in value ||
    'rtt' in value ||
    'saveData' in value
  );
}

export function hasEventListener(connection: unknown): connection is { addEventListener: (event: string, handler: () => void) => void } {
  return isObject(connection) && 'addEventListener' in connection && typeof (connection as { addEventListener?: unknown }).addEventListener === 'function';
}

// テスト用のモック型定義
export interface MockRequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export function isMockRequestOptions(value: unknown): value is MockRequestOptions {
  return isObject(value);
}

// AuthService のモック型定義
export interface MockAuthService {
  generateCameraToken: jest.MockedFunction<(participantId: string, eventId: string, participantName?: string) => Promise<string>>;
  generateLiveKitToken: jest.MockedFunction<(participantId: string, eventId: string, participantName?: string) => Promise<string>>;
  generateAdminToken: jest.MockedFunction<(adminId: string, eventId?: string) => Promise<string>>;
  [key: string]: any;
}

export function isMockAuthService(value: unknown): value is MockAuthService {
  return isObject(value) && 'generateCameraToken' in value && 'generateLiveKitToken' in value;
}

// テスト環境の型定義
export interface TestEnvironment {
  NODE_ENV?: string;
  JWT_SECRET?: string;
  [key: string]: string | undefined;
}

export function isTestEnvironment(value: unknown): value is TestEnvironment {
  return isObject(value);
}

// テスト用のwindow.locationモック型定義
export interface MockLocation {
  origin: string;
  href?: string;
  pathname?: string;
  search?: string;
  hash?: string;
}

export interface MockWindow extends Omit<Window, 'location'> {
  location?: MockLocation;
}

export function createMockLocation(origin: string = 'http://localhost:3000'): MockLocation {
  return {
    origin,
    href: origin,
    pathname: '/',
    search: '',
    hash: '',
  };
}

// Jest モック関数の型定義
export interface JestMockFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>;
  mockImplementation: (fn: T) => JestMockFunction<T>;
  mockResolvedValue: (value: Awaited<ReturnType<T>>) => JestMockFunction<T>;
  mockRejectedValue: (error: any) => JestMockFunction<T>;
  mockReturnValue: (value: ReturnType<T>) => JestMockFunction<T>;
  mockClear: () => void;
  mockReset: () => void;
}

export function isJestMockFunction<T extends (...args: any[]) => any>(value: unknown): value is JestMockFunction<T> {
  return typeof value === 'function' && 'mockImplementation' in value;
}

// QRCode モック型定義
export interface MockQRCodeToDataURL {
  mockResolvedValue: (value: string) => MockQRCodeToDataURL;
  mockRejectedValueOnce: (error: Error) => MockQRCodeToDataURL;
  mockImplementationOnce: (fn: () => Promise<string>) => MockQRCodeToDataURL;
  mockClear: () => void;
  mockReset: () => void;
}

export function createMockQRCodeToDataURL(): MockQRCodeToDataURL {
  const mock = jest.fn() as any;
  mock.mockResolvedValue = jest.fn().mockReturnValue(mock);
  mock.mockRejectedValueOnce = jest.fn().mockReturnValue(mock);
  mock.mockImplementationOnce = jest.fn().mockReturnValue(mock);
  mock.mockClear = jest.fn();
  mock.mockReset = jest.fn();
  return mock;
}

// テスト用のモック要素型定義
export interface MockHTMLElement {
  focus: jest.MockedFunction<() => void>;
  blur?: jest.MockedFunction<() => void>;
  select?: jest.MockedFunction<() => void>;
}

export interface MockHTMLInputElement extends MockHTMLElement {
  select: jest.MockedFunction<() => void>;
}

export function createMockHTMLInputElement(): HTMLInputElement & { focus: jest.MockedFunction<() => void> } {
  return {
    focus: jest.fn(),
    blur: jest.fn(),
    select: jest.fn(),
  } as unknown as HTMLInputElement & { focus: jest.MockedFunction<() => void> };
}

export function createMockHTMLElement(): HTMLElement {
  return {
    focus: jest.fn(),
    blur: jest.fn(),
  } as unknown as HTMLElement;
}
