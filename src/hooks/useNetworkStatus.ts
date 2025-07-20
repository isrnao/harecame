'use client';

import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string;
  lastChecked: Date;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: true,
    isSlowConnection: false,
    connectionType: 'unknown',
    lastChecked: new Date(),
  });

  const [retryCount, setRetryCount] = useState(0);

  // ネットワーク状態を更新
  const updateNetworkStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    const connection = (navigator as unknown as { 
      connection?: unknown; 
      mozConnection?: unknown; 
      webkitConnection?: unknown; 
    }).connection || 
    (navigator as unknown as { mozConnection?: unknown }).mozConnection || 
    (navigator as unknown as { webkitConnection?: unknown }).webkitConnection;

    let isSlowConnection = false;
    let connectionType = 'unknown';

    if (connection) {
      const conn = connection as { 
        effectiveType?: string; 
      };
      connectionType = conn.effectiveType || 'unknown';
      // 2G以下を低速接続と判定
      isSlowConnection = ['slow-2g', '2g'].includes(conn.effectiveType || '');
    }

    setNetworkStatus({
      isOnline,
      isSlowConnection,
      connectionType,
      lastChecked: new Date(),
    });
  }, []);

  // 指数バックオフによるリトライ
  const retryWithBackoff = useCallback(async <T>(
    operation: () => Promise<T>,
    config: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2,
    }
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        setRetryCount(attempt);
        const result = await operation();
        setRetryCount(0); // 成功時はリセット
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === config.maxRetries) {
          break; // 最大試行回数に達した
        }

        // 指数バックオフによる遅延
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffFactor, attempt),
          config.maxDelay
        );

        console.log(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    setRetryCount(0);
    throw lastError!;
  }, []);

  // ネットワーク接続テスト
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // ネットワーク状態の監視
  useEffect(() => {
    updateNetworkStatus();

    const handleOnline = () => {
      console.log('Network: Back online');
      updateNetworkStatus();
    };

    const handleOffline = () => {
      console.log('Network: Gone offline');
      updateNetworkStatus();
    };

    // イベントリスナーを追加
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 接続状態の定期チェック（30秒間隔）
    const interval = setInterval(async () => {
      const isConnected = await testConnection();
      if (isConnected !== networkStatus.isOnline) {
        updateNetworkStatus();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [updateNetworkStatus, testConnection, networkStatus.isOnline]);

  return {
    networkStatus,
    retryCount,
    retryWithBackoff,
    testConnection,
    updateNetworkStatus,
  };
}