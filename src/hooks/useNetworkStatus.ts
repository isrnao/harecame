'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { NavigatorWithConnection } from '@/lib/type-guards';

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

// External store for network status synchronization
class NetworkStatusStore {
  private listeners = new Set<() => void>();
  private networkStatus: NetworkStatus = {
    isOnline: true,
    isSlowConnection: false,
    connectionType: 'unknown',
    lastChecked: new Date(),
  };
  private cachedSnapshot: NetworkStatus | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeNetworkStatus();
      this.setupEventListeners();
    }
  }

  private initializeNetworkStatus() {
    this.updateNetworkStatus();
  }

  private setupEventListeners() {
    const handleOnline = () => {
      console.log('Network: Back online');
      this.updateNetworkStatus();
    };

    const handleOffline = () => {
      console.log('Network: Gone offline');
      this.updateNetworkStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Connection API change listener
    const connection = this.getConnection();
    if (connection && typeof connection === 'object' && 'addEventListener' in connection) {
      const conn = connection as { addEventListener: (event: string, handler: () => void) => void };
      conn.addEventListener('change', () => this.updateNetworkStatus());
    }
  }

  private getConnection() {
    const nav = navigator as NavigatorWithConnection;
    return nav.connection || nav.mozConnection || nav.webkitConnection;
  }

  private updateNetworkStatus() {
    const isOnline = navigator.onLine;
    const connection = this.getConnection();

    let isSlowConnection = false;
    let connectionType = 'unknown';

    if (connection) {
      const conn = connection as {
        effectiveType?: string;
      };
      connectionType = conn.effectiveType || 'unknown';
      isSlowConnection = ['slow-2g', '2g'].includes(conn.effectiveType || '');
    }

    this.networkStatus = {
      isOnline,
      isSlowConnection,
      connectionType,
      lastChecked: new Date(),
    };

    // キャッシュを無効化
    this.cachedSnapshot = null;
    this.notifyListeners();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = this.networkStatus;
    }
    return this.cachedSnapshot;
  };

  getServerSnapshot = () => {
    return {
      isOnline: true,
      isSlowConnection: false,
      connectionType: 'unknown',
      lastChecked: new Date(),
    };
  };

  private notifyListeners = () => {
    this.listeners.forEach(listener => listener());
  };

  // Public method to force update
  forceUpdate = () => {
    this.updateNetworkStatus();
  };
}

const networkStatusStore = new NetworkStatusStore();

export function useNetworkStatus() {
  // Use external store for network status synchronization
  const networkStatus = useSyncExternalStore(
    networkStatusStore.subscribe,
    networkStatusStore.getSnapshot,
    networkStatusStore.getServerSnapshot
  );

  const [retryCount, setRetryCount] = useState(0);

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

  // 接続状態の定期チェック（30秒間隔）
  useEffect(() => {
    const interval = setInterval(async () => {
      const isConnected = await testConnection();
      if (isConnected !== networkStatus.isOnline) {
        networkStatusStore.forceUpdate();
      }
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [testConnection, networkStatus.isOnline]);

  // updateNetworkStatus関数をストアの更新メソッドにマップ
  const updateNetworkStatus = useCallback(() => {
    networkStatusStore.forceUpdate();
  }, []);

  return {
    networkStatus,
    retryCount,
    retryWithBackoff,
    testConnection,
    updateNetworkStatus,
  };
}
