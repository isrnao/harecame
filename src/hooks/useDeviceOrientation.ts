'use client';

import { useState, useEffect } from 'react';

export interface DeviceOrientation {
  orientation: 'portrait' | 'landscape';
  angle: number;
  isSupported: boolean;
}

export function useDeviceOrientation(): DeviceOrientation {
  const [orientation, setOrientation] = useState<DeviceOrientation>({
    orientation: 'portrait',
    angle: 0,
    isSupported: false,
  });

  useEffect(() => {
    // Check if orientation API is supported
    const isSupported = 'orientation' in screen || 'orientation' in window;
    
    const updateOrientation = () => {
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

      setOrientation({
        orientation: orientationType,
        angle,
        isSupported,
      });
    };

    // Initial check
    updateOrientation();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated
      setTimeout(updateOrientation, 100);
    };

    // Add event listeners
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return orientation;
}