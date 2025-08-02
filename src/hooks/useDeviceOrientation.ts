'use client';

import { useSyncExternalStore } from 'react';

export interface DeviceOrientation {
  orientation: 'portrait' | 'landscape';
  angle: number;
  isSupported: boolean;
}

// External store for device orientation synchronization
class DeviceOrientationStore {
  private listeners = new Set<() => void>();
  private orientation: DeviceOrientation = {
    orientation: 'portrait',
    angle: 0,
    isSupported: false,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeOrientation();
      this.setupEventListeners();
    }
  }

  private initializeOrientation() {
    // Check if orientation API is supported
    const isSupported = 'orientation' in screen || 'orientation' in window;
    this.orientation.isSupported = isSupported;
    this.updateOrientation();
  }

  private setupEventListeners() {
    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated
      setTimeout(() => this.updateOrientation(), 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
  }

  private updateOrientation() {
    let angle = 0;
    let orientationType: 'portrait' | 'landscape' = 'portrait';

    if (typeof window === 'undefined') {
      return;
    }

    // Try different methods to get orientation
    if ('orientation' in screen && screen.orientation) {
      angle = screen.orientation.angle;
      orientationType = screen.orientation.type.includes('landscape') ? 'landscape' : 'portrait';
    } else if ('orientation' in window) {
      angle = (window as unknown as { orientation: number }).orientation;
      orientationType = Math.abs(angle) === 90 ? 'landscape' : 'portrait';
    } else {
      // Fallback: use window dimensions
      const win = window as Window;
      orientationType = win.innerWidth > win.innerHeight ? 'landscape' : 'portrait';
    }

    this.orientation = {
      orientation: orientationType,
      angle,
      isSupported: this.orientation.isSupported,
    };

    this.notifyListeners();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => {
    return this.orientation;
  };

  getServerSnapshot = () => {
    return {
      orientation: 'portrait' as const,
      angle: 0,
      isSupported: false,
    };
  };

  private notifyListeners = () => {
    this.listeners.forEach(listener => listener());
  };
}

const deviceOrientationStore = new DeviceOrientationStore();

export function useDeviceOrientation(): DeviceOrientation {
  // Use external store for device orientation synchronization
  const orientation = useSyncExternalStore(
    deviceOrientationStore.subscribe,
    deviceOrientationStore.getSnapshot,
    deviceOrientationStore.getServerSnapshot
  );

  return orientation;
}
