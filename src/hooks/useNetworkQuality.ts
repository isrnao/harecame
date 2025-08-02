'use client';

import { useSyncExternalStore } from 'react';

export interface NetworkQuality {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlink: number;
  rtt: number;
  saveData: boolean;
  isSupported: boolean;
}

export interface VideoQualitySettings {
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}

// External store for network quality synchronization
class NetworkQualityStore {
  private listeners = new Set<() => void>();
  private networkQuality: NetworkQuality = {
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
    isSupported: false,
  };
  private recommendedQuality: VideoQualitySettings = {
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 2500,
  };
  private cachedSnapshot: { networkQuality: NetworkQuality; recommendedQuality: VideoQualitySettings } | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeNetworkQuality();
      this.setupEventListeners();
    }
  }

  private getConnection() {
    return (navigator as unknown as {
      connection?: unknown;
      mozConnection?: unknown;
      webkitConnection?: unknown;
    }).connection ||
    (navigator as unknown as { mozConnection?: unknown }).mozConnection ||
    (navigator as unknown as { webkitConnection?: unknown }).webkitConnection;
  }

  private initializeNetworkQuality() {
    this.updateNetworkInfo();
  }

  private setupEventListeners() {
    const connection = this.getConnection();
    if (connection && typeof connection === 'object' && 'addEventListener' in connection) {
      const conn = connection as { addEventListener: (event: string, handler: () => void) => void };
      conn.addEventListener('change', () => this.updateNetworkInfo());
    }
  }

  private updateNetworkInfo() {
    const connection = this.getConnection();

    if (connection) {
      const conn = connection as {
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
      };

      const quality: NetworkQuality = {
        effectiveType: (conn.effectiveType as '4g' | '3g' | '2g' | 'slow-2g') || 'unknown',
        downlink: conn.downlink || 0,
        rtt: conn.rtt || 0,
        saveData: conn.saveData || false,
        isSupported: true,
      };

      this.networkQuality = quality;
      this.recommendedQuality = calculateRecommendedQuality(quality);
    } else {
      this.networkQuality = { ...this.networkQuality, isSupported: false };
    }

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
      this.cachedSnapshot = {
        networkQuality: this.networkQuality,
        recommendedQuality: this.recommendedQuality,
      };
    }
    return this.cachedSnapshot;
  };

  getServerSnapshot = () => {
    return {
      networkQuality: {
        effectiveType: 'unknown' as const,
        downlink: 0,
        rtt: 0,
        saveData: false,
        isSupported: false,
      },
      recommendedQuality: {
        width: 1280,
        height: 720,
        frameRate: 30,
        bitrate: 2500,
      },
    };
  };

  private notifyListeners = () => {
    this.listeners.forEach(listener => listener());
  };
}

const networkQualityStore = new NetworkQualityStore();

export function useNetworkQuality() {
  // Use external store for network quality synchronization
  const { networkQuality, recommendedQuality } = useSyncExternalStore(
    networkQualityStore.subscribe,
    networkQualityStore.getSnapshot,
    networkQualityStore.getServerSnapshot
  );

  return { networkQuality, recommendedQuality };
}

function calculateRecommendedQuality(network: NetworkQuality): VideoQualitySettings {
  // データセーバーモードが有効な場合は低品質
  if (network.saveData) {
    return {
      width: 640,
      height: 360,
      frameRate: 15,
      bitrate: 500,
    };
  }

  // 接続タイプに基づく品質調整
  switch (network.effectiveType) {
    case '4g':
      // 高速接続: 高品質
      return {
        width: 1280,
        height: 720,
        frameRate: 30,
        bitrate: 2500,
      };

    case '3g':
      // 中速接続: 中品質
      return {
        width: 854,
        height: 480,
        frameRate: 24,
        bitrate: 1200,
      };

    case '2g':
    case 'slow-2g':
      // 低速接続: 低品質
      return {
        width: 640,
        height: 360,
        frameRate: 15,
        bitrate: 500,
      };

    default:
      // 不明な接続: 中品質（安全側）
      return {
        width: 854,
        height: 480,
        frameRate: 24,
        bitrate: 1200,
      };
  }
}
