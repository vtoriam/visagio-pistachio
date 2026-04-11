import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFacilities } from '@urgentnow/api-client';
import type { Facility, FilterState, LatLng } from '@urgentnow/types';
import { google } from '@vis.gl/react-google-maps';

interface UseFacilitiesResult {
  facilities: Facility[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFacilities(
  location: LatLng,
  filters: Pick<FilterState, 'radiusKm' | 'showHospitals' | 'showUrgentCare' | 'showPharmacies'>
): UseFacilitiesResult {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const data = await fetchFacilities(location, filters);

      // Compute distances client-side using the Geometry library
      const userLatLng = new window.google.maps.LatLng(location.lat, location.lng);
      const withDistances = data.facilities.map((f) => {
        const facilityLatLng = new window.google.maps.LatLng(f.location.lat, f.location.lng);
        const distanceMetres = window.google.maps.geometry.spherical.computeDistanceBetween(
          userLatLng,
          facilityLatLng
        );
        return { ...f, distanceMetres: Math.round(distanceMetres) };
      });

      setFacilities(withDistances);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Could not load facilities. Please try again.');
      console.error('[useFacilities]', err);
    } finally {
      setLoading(false);
    }
  }, [location.lat, location.lng, filters.radiusKm, filters.showHospitals, filters.showUrgentCare, filters.showPharmacies]);

  useEffect(() => { load(); }, [load]);

  return { facilities, loading, error, refresh: load };
}
