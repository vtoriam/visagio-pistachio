'use client';

import { useState, useCallback, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { MapView } from '../components/MapView';
import { Sidebar } from '../components/Sidebar';
import { DetailPanel } from '../components/DetailPanel';
import { TriageModal } from '../components/TriageModal';
import { FilterBar } from '../components/FilterBar';
import { useUserLocation } from '../hooks/useUserLocation';
import { useFacilities } from '../hooks/useFacilities';
import { filterFacilities, sortFacilities } from '@urgentnow/api-client';
import type { Facility, FilterState } from '@urgentnow/types';

const DEFAULT_PERTH: { lat: number; lng: number } = { lat: -31.9505, lng: 115.8605 };

const DEFAULT_FILTERS: FilterState = {
  showHospitals: true,
  showUrgentCare: true,
  showPharmacies: true,
  radiusKm: 10,
  sortBy: 'distance',
  openNowOnly: false,
};

export default function HomePage() {
  const { location } = useUserLocation(DEFAULT_PERTH);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [showTriage, setShowTriage] = useState(false);

  const { facilities, loading, error, refresh } = useFacilities(location, filters);

  // Auto-refresh every 2 min (keep in sync with backend poll)
  useEffect(() => {
    const id = setInterval(refresh, 120_000);
    return () => clearInterval(id);
  }, [refresh]);

  const visibleFacilities = sortFacilities(
    filterFacilities(facilities, filters),
    filters.sortBy
  );

  const handleTriageResult = useCallback(
    (type: Facility['type'] | 'ED_EMERGENCY') => {
      setShowTriage(false);
      if (type === 'ED_EMERGENCY' || type === 'hospital') {
        setFilters((f) => ({ ...f, showHospitals: true, showUrgentCare: false, showPharmacies: false, sortBy: 'waitTime' }));
      } else if (type === 'urgentCare') {
        setFilters((f) => ({ ...f, showHospitals: false, showUrgentCare: true, showPharmacies: false, sortBy: 'distance' }));
      } else {
        setFilters((f) => ({ ...f, showHospitals: false, showUrgentCare: false, showPharmacies: true, sortBy: 'openNow' }));
      }
    },
    []
  );

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!} libraries={['places', 'geometry']}>
      <div className="app-shell">
        {/* Top bar */}
        <header className="topbar">
          <div className="logo">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1C5.686 1 3 3.686 3 7c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6Z" fill="#E63946"/>
              <circle cx="9" cy="7" r="2.2" fill="white"/>
            </svg>
          </div>
          <h1 className="app-title">UrgentNow</h1>
          <div className="header-center">
            <FilterBar filters={filters} onChange={setFilters} />
          </div>
          <button className="triage-btn" onClick={() => setShowTriage(true)}>
            What do I need? →
          </button>
        </header>

        {/* Main layout */}
        <div className="main-layout">
          <Sidebar
            facilities={visibleFacilities}
            loading={loading}
            error={error}
            selectedId={selectedFacility?.id ?? null}
            onSelect={setSelectedFacility}
            filters={filters}
            onFiltersChange={setFilters}
          />

          <div className="map-container">
            <MapView
              facilities={visibleFacilities}
              userLocation={location}
              radiusKm={filters.radiusKm}
              selectedId={selectedFacility?.id ?? null}
              onSelect={setSelectedFacility}
            />

            {selectedFacility && (
              <DetailPanel
                facility={selectedFacility}
                userLocation={location}
                onClose={() => setSelectedFacility(null)}
              />
            )}
          </div>
        </div>

        {showTriage && (
          <TriageModal
            onResult={handleTriageResult}
            onClose={() => setShowTriage(false)}
          />
        )}
      </div>
    </APIProvider>
  );
}
