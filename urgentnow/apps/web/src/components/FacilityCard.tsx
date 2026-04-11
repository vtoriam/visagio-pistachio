'use client';

import type { Facility } from '@urgentnow/types';

interface FacilityCardProps {
  facility: Facility;
  isSelected: boolean;
  onClick: () => void;
}

const TYPE_CONFIG = {
  hospital: { label: 'Emergency', color: '#E63946', bg: '#FEE2E2', text: '#B91C1C' },
  urgentCare: { label: 'Urgent care', color: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
  pharmacy: { label: 'Pharmacy', color: '#10B981', bg: '#D1FAE5', text: '#065F46' },
};

export function FacilityCard({ facility, isSelected, onClick }: FacilityCardProps) {
  const config = TYPE_CONFIG[facility.type];
  const wait = facility.edWaitData?.waitMinutes;
  const distKm = facility.distanceMetres != null
    ? (facility.distanceMetres / 1000).toFixed(1)
    : null;
  const isOpen = facility.openingHours?.openNow;

  return (
    <button
      className={`facility-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="card-top">
        <div className="card-name-row">
          <span className="card-dot" style={{ background: config.color }} />
          <span className="card-name">{facility.name}</span>
        </div>
        <span
          className="card-badge"
          style={{ background: config.bg, color: config.text }}
        >
          {config.label}
        </span>
      </div>

      <div className="card-meta">
        {/* Wait time pill (hospitals) */}
        {wait != null && (
          <span className={`wait-pill ${waitClass(wait)}`}>
            {formatWait(wait)} wait
          </span>
        )}

        {/* Busyness bar (urgent care / pharmacy) */}
        {wait == null && facility.busyTimes?.currentBusyness != null && (
          <div className="busy-row">
            <span className="busy-label">{facility.busyTimes.label ?? 'Busy'}</span>
            <div className="busy-track">
              <div
                className="busy-fill"
                style={{
                  width: `${facility.busyTimes.currentBusyness}%`,
                  background: busyColor(facility.busyTimes.currentBusyness),
                }}
              />
            </div>
          </div>
        )}

        {/* Distance */}
        {distKm && <span className="card-dist">{distKm} km</span>}

        {/* Open status */}
        {facility.openingHours != null && (
          <span className={`open-status ${isOpen ? 'open' : 'closed'}`}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        )}

        {/* Patients waiting (hospitals) */}
        {facility.edWaitData?.patientsWaiting != null && (
          <span className="patients-count">
            {facility.edWaitData.patientsWaiting} waiting
          </span>
        )}
      </div>
    </button>
  );
}

export function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function waitClass(minutes: number) {
  if (minutes <= 30) return 'wait-low';
  if (minutes <= 90) return 'wait-med';
  return 'wait-high';
}

function busyColor(pct: number) {
  if (pct < 40) return '#10B981';
  if (pct < 70) return '#F59E0B';
  return '#E63946';
}
