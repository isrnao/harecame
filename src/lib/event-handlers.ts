/**
 * 共通のイベント処理ロジック
 * React 19のベストプラクティスに従い、useEffectではなくイベントハンドラーで処理するロジックを集約
 */

import { useCallback, useRef } from 'react';

// 共通のエラーハンドリング
export interface EventHandlerError {
  message: string;
  code?: string;
  retry?: () => void;
}

// 共通のイベントハンドラー結果
export interface EventHandlerResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: EventHandlerError;
}

// 共通のローディング状態管理
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

/**
 * 共通のエラーハンドリング関数
 */
export const handleEventError = (error: unknown, context: string): EventHandlerError => {
  console.error(`Error in ${context}:`, error);

  if (error instanceof Error) {
    // ネットワークエラーの場合
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        message: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
        code: 'NETWORK_ERROR',
      };
    }

    // タイムアウトエラーの場合
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return {
        message: '処理がタイムアウトしました。もう一度お試しください。',
        code: 'TIMEOUT_ERROR',
      };
    }

    // 認証エラーの場合
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return {
        message: '認証に失敗しました。再度ログインしてください。',
        code: 'AUTH_ERROR',
      };
    }

    // 権限エラーの場合
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return {
        message: 'この操作を実行する権限がありません。',
        code: 'PERMISSION_ERROR',
      };
    }

    // リソースが見つからない場合
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      return {
        message: 'リソースが見つかりません。URLを確認してください。',
        code: 'NOT_FOUND_ERROR',
      };
    }

    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
    };
  }

  return {
    message: '予期しないエラーが発生しました。',
    code: 'UNKNOWN_ERROR',
  };
};

/**
 * 共通のデータ更新ハンドラー（カスタムフック）
 */
export const useDataUpdateHandler = <T>(
  updateFunction: () => Promise<T>,
  onSuccess?: (data: T) => void,
  onError?: (error: EventHandlerError) => void,
  context = 'data update'
) => {
  return useCallback(async (): Promise<EventHandlerResult<T>> => {
    try {
      const data = await updateFunction();
      onSuccess?.(data);
      return { success: true, data };
    } catch (error) {
      const handledError = handleEventError(error, context);
      onError?.(handledError);
      return { success: false, error: handledError };
    }
  }, [updateFunction, onSuccess, onError, context]);
};

/**
 * 共通の接続ハンドラー（カスタムフック）
 */
export const useConnectionHandler = (
  connectFunction: () => Promise<void>,
  onSuccess?: () => void,
  onError?: (error: EventHandlerError) => void,
  context = 'connection'
) => {
  return useCallback(async (): Promise<EventHandlerResult> => {
    try {
      await connectFunction();
      onSuccess?.();
      return { success: true };
    } catch (error) {
      const handledError = handleEventError(error, context);
      onError?.(handledError);
      return { success: false, error: handledError };
    }
  }, [connectFunction, onSuccess, onError, context]);
};

/**
 * 共通の切断ハンドラー（カスタムフック）
 */
export const useDisconnectionHandler = (
  disconnectFunction: () => Promise<void>,
  onSuccess?: () => void,
  onError?: (error: EventHandlerError) => void,
  context = 'disconnection'
) => {
  return useCallback(async (): Promise<EventHandlerResult> => {
    try {
      await disconnectFunction();
      onSuccess?.();
      return { success: true };
    } catch (error) {
      const handledError = handleEventError(error, context);
      onError?.(handledError);
      return { success: false, error: handledError };
    }
  }, [disconnectFunction, onSuccess, onError, context]);
};

/**
 * 共通のクリップボードコピーハンドラー（カスタムフック）
 */
export const useClipboardHandler = (
  onSuccess?: (text: string) => void,
  onError?: (error: EventHandlerError) => void
) => {
  return useCallback(async (text: string): Promise<EventHandlerResult> => {
    try {
      await navigator.clipboard.writeText(text);
      onSuccess?.(text);
      return { success: true };
    } catch (error) {
      const handledError = handleEventError(error, 'clipboard copy');
      onError?.(handledError);
      return { success: false, error: handledError };
    }
  }, [onSuccess, onError]);
};

/**
 * 共通のメディア権限ハンドラー（カスタムフック）
 */
export const useMediaPermissionHandler = (
  onSuccess?: (stream: MediaStream) => void,
  onError?: (error: EventHandlerError) => void
) => {
  return useCallback(async (constraints: MediaStreamConstraints): Promise<EventHandlerResult<MediaStream>> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      onSuccess?.(stream);
      return { success: true, data: stream };
    } catch (error) {
      let handledError: EventHandlerError;

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          handledError = {
            message: 'カメラまたはマイクへのアクセスが拒否されました。ブラウザの設定を確認してください。',
            code: 'PERMISSION_DENIED',
          };
        } else if (error.name === 'NotFoundError') {
          handledError = {
            message: 'カメラまたはマイクが見つかりません。デバイスが接続されているか確認してください。',
            code: 'DEVICE_NOT_FOUND',
          };
        } else if (error.name === 'NotReadableError') {
          handledError = {
            message: 'カメラまたはマイクが他のアプリケーションで使用されています。',
            code: 'DEVICE_IN_USE',
          };
        } else {
          handledError = handleEventError(error, 'media permission');
        }
      } else {
        handledError = handleEventError(error, 'media permission');
      }

      onError?.(handledError);
      return { success: false, error: handledError };
    }
  }, [onSuccess, onError]);
};

/**
 * 共通のフォーム送信ハンドラー（カスタムフック）
 */
export const useFormSubmissionHandler = <T>(
  submitFunction: (formData: FormData) => Promise<T>,
  onSuccess?: (data: T) => void,
  onError?: (error: EventHandlerError) => void,
  context = 'form submission'
) => {
  return useCallback(async (formData: FormData): Promise<EventHandlerResult<T>> => {
    try {
      const data = await submitFunction(formData);
      onSuccess?.(data);
      return { success: true, data };
    } catch (error) {
      const handledError = handleEventError(error, context);
      onError?.(handledError);
      return { success: false, error: handledError };
    }
  }, [submitFunction, onSuccess, onError, context]);
};

/**
 * 共通のリトライハンドラー（カスタムフック）
 */
export const useRetryHandler = <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  backoffFactor = 2,
  onRetry?: (attempt: number, error: unknown) => void
) => {
  return useCallback(async (): Promise<EventHandlerResult<T>> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await operation();
        return { success: true, data };
      } catch (error) {
        lastError = error;
        onRetry?.(attempt, error);

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const handledError = handleEventError(lastError, 'retry operation');
    return { success: false, error: handledError };
  }, [operation, maxRetries, baseDelay, backoffFactor, onRetry]);
};

/**
 * 共通のデバウンスハンドラー（カスタムフック）
 */
export const useDebouncedHandler = <T extends unknown[]>(
  handler: (...args: T) => void | Promise<void>,
  delay = 300
) => {
  const timeoutRef = useRef<number | undefined>(undefined);

  return useCallback((...args: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      handler(...args);
    }, delay);
  }, [handler, delay]);
};

/**
 * 共通のスロットルハンドラー（カスタムフック）
 */
export const useThrottledHandler = <T extends unknown[]>(
  handler: (...args: T) => void | Promise<void>,
  delay = 300
) => {
  const lastCallRef = useRef(0);

  return useCallback((...args: T) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      handler(...args);
    }
  }, [handler, delay]);
};
