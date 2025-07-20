'use client';

import { useState, useEffect } from 'react';

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

export function useNetworkQuality() {
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
    isSupported: false,
  });

  const [recommendedQuality, setRecommendedQuality] = useState<VideoQualitySettings>({
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 2500,
  });

  useEffect(() => {
    const updateNetworkInfo = () => {
      const connection = (navigator as unknown as { 
        connection?: unknown; 
        mozConnection?: unknown; 
        webkitConnection?: unknown; 
      }).connection || 
      (navigator as unknown as { mozConnection?: unknown }).mozConnection || 
      (navigator as unknown as { webkitConnection?: unknown }).webkitConnection;

      if (connection) {
        const conn = connection as { 
          effectiveType?: string; 
          downlink?: number; 
          rtt?: number; 
          saveData?: boolean; 
          addEventListener?: (event: string, handler: () => void) => void;
          removeEventListener?: (event: string, handler: () => void) => void;
        };
        const quality: NetworkQuality = {
          effectiveType: (conn.effectiveType as '4g' | '3g' | '2g' | 'slow-2g') || 'unknown',
          downlink: conn.downlink || 0,
          rtt: conn.rtt || 0,
          saveData: conn.saveData || false,
          isSupported: true,
        };

        setNetworkQuality(quality);

        // 品質に基づく推奨設定を計算
        const recommended = calculateRecommendedQuality(quality);
        setRecommendedQuality(recommended);
      } else {
        setNetworkQuality(prev => ({ ...prev, isSupported: false }));
      }
    };

    // 初期チェック
    updateNetworkInfo();

    // ネットワーク変更の監視
    const connection = (navigator as unknown as { 
      connection?: unknown; 
      mozConnection?: unknown; 
      webkitConnection?: unknown; 
    }).connection || 
    (navigator as unknown as { mozConnection?: unknown }).mozConnection || 
    (navigator as unknown as { webkitConnection?: unknown }).webkitConnection;

    if (connection) {
      const conn = connection as { 
        addEventListener?: (event: string, handler: () => void) => void;
        removeEventListener?: (event: string, handler: () => void) => void;
      };
      
      if (conn.addEventListener) {
        conn.addEventListener('change', updateNetworkInfo);
        
        return () => {
          if (conn.removeEventListener) {
            conn.removeEventListener('change', updateNetworkInfo);
          }
        };
      }
    }
  }, []);

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