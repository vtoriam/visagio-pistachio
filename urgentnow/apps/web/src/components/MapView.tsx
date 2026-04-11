'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import type { Facility, LatLng } from '@urgentnow/types';

interface MapViewProps {
  facilities: Facility[];
  userLocation: LatLng;
  radiusKm: number;
  selectedId: string | null;
  onSelect: (facility: Facility) => void;
}

const FACILITY_COLORS = {
  hospital: '#E63946',
  urgentCare: '#F59E0B',
  pharmacy: '#10B981',
};

const FACILITY_LABELS = {
  hospital: 'H',
  urgentCare: 'U',
  pharmacy: 'P',
};

export function MapView({ facilities, userLocation, radiusKm, selectedId, onSelect }: MapViewProps) {
  const map = useMap();
  const geometryLib = useMapsLibrary('geometry');
  const circleRef = useRef<google.maps.Circle | null>(null);

  // Draw radius circle
  useEffect(() => {
    if (!map) return;
    circleRef.current?.setMap(null);
    circleRef.current = new google.maps.Circle({
      map,
      center: userLocation,
      radius: radiusKm * 1000,
      strokeColor: '#E63946',
      strokeOpacity: 0.25,
      strokeWeight: 1.5,
      fillColor: '#E63946',
      fillOpacity: 0.04,
    });
    return () => { circleRef.current?.setMap(null); };
  }, [map, userLocation, radiusKm]);

  // Pan to selected facility
  useEffect(() => {
    if (!map || !selectedId) return;
    const facility = facilities.find((f) => f.id === selectedId);
    if (facility) {
      map.panTo({ lat: facility.location.lat, lng: facility.location.lng });
    }
  }, [map, selectedId, facilities]);

  return (
    <Map
      mapId="urgentnow-map"
      defaultCenter={userLocation}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI={false}
      zoomControl={true}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      {/* User location dot */}
      <AdvancedMarker position={userLocation}>
        <div className="user-dot">
          <div className="user-dot-pulse" />
        </div>
      </AdvancedMarker>

      {/* Facility markers */}
      {facilities.map((facility) => (
        <FacilityMarker
          key={facility.id}
          facility={facility}
          isSelected={facility.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </Map>
  );
}

function FacilityMarker({
  facility,
  isSelected,
  onSelect,
}: {
  facility: Facility;
  isSelected: boolean;
  onSelect: (f: Facility) => void;
}) {
  const color = FACILITY_COLORS[facility.type];
  const label = FACILITY_LABELS[facility.type];
  const waitMin = facility.edWaitData?.waitMinutes;

  return (
    <AdvancedMarker
      position={facility.location}
      onClick={() => onSelect(facility)}
      zIndex={isSelected ? 100 : 1}
    >
      <div
        className={`facility-pin ${isSelected ? 'selected' : ''}`}
        style={{ '--pin-color': color } as React.CSSProperties}
      >
        <span className="pin-label">{label}</span>
        {waitMin != null && (
          <div className="pin-wait-badge" style={{ background: waitBadgeColor(waitMin) }}>
            {waitMin >= 60
              ? `${Math.floor(waitMin / 60)}h${waitMin % 60 > 0 ? `${waitMin % 60}m` : ''}`
              : `${waitMin}m`}
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
}

function waitBadgeColor(minutes: number): string {
  if (minutes <= 30) return '#10B981';
  if (minutes <= 90) return '#F59E0B';
  return '#E63946';
}
