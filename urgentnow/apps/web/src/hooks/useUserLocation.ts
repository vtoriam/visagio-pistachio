import { useState, useEffect } from 'react';
import type { LatLng } from '@urgentnow/types';

export function useUserLocation(fallback: LatLng) {
  const [location, setLocation] = useState<LatLng>(fallback);
  const [status, setStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('denied');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('granted');
      },
      () => {
        setStatus('denied');
        // Keep the Perth fallback
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  return { location, status };
}
