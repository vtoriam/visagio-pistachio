'use client';

import { useState } from 'react';
import type { Facility, LatLng } from '@urgentnow/types';
import { formatWait } from './FacilityCard';
import { useAlerts } from '../hooks/useAlerts';

interface DetailPanelProps {
  facility: Facility;
  userLocation: LatLng;
  onClose: () => void;
}

const ALERT_PRESETS = [30, 60, 90, 120];

export function DetailPanel({ facility, userLocation, onClose }: DetailPanelProps) {
  const { subscribe, unsubscribe, getAlertForHospital } = useAlerts();
  const [alertThreshold, setAlertThreshold] = useState(60);
  const [alertLoading, setAlertLoading] = useState(false);
  const existingAlert = getAlertForHospital(facility.id);

  const wait = facility.edWaitData?.waitMinutes;
  const isOpen = facility.openingHours?.openNow;

  const handleAlertToggle = async () => {
    setAlertLoading(true);
    try {
      if (existingAlert) {
        await unsubscribe(existingAlert.id);
      } else {
        await subscribe(facility.id, facility.name, alertThreshold);
      }
    } finally {
      setAlertLoading(false);
    }
  };

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.location.lat},${facility.location.lng}&destination_place_id=${facility.placeId}&travelmode=driving`;

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <h2 className="detail-name">{facility.name}</h2>
          <p className="detail-address">{facility.address}</p>
        </div>
        <button className="detail-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="detail-rows">
        {/* Wait time */}
        {wait != null && (
          <div className="detail-row">
            <span className="detail-label">Current wait</span>
            <span className={`wait-pill ${wait <= 30 ? 'wait-low' : wait <= 90 ? 'wait-med' : 'wait-high'}`}>
              {formatWait(wait)}
            </span>
          </div>
        )}

        {/* Patients */}
        {facility.edWaitData?.patientsWaiting != null && (
          <>
            <div className="detail-row">
              <span className="detail-label">Patients waiting</span>
              <span className="detail-val">{facility.edWaitData.patientsWaiting}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Patients in dept</span>
              <span className="detail-val">{facility.edWaitData.patientsInDept}</span>
            </div>
          </>
        )}

        {/* Busyness */}
        {facility.busyTimes?.currentBusyness != null && (
          <div className="detail-row">
            <span className="detail-label">How busy</span>
            <span className="detail-val">{facility.busyTimes.label ?? `${facility.busyTimes.currentBusyness}%`}</span>
          </div>
        )}

        {/* Open status */}
        {facility.openingHours && (
          <div className="detail-row">
            <span className="detail-label">Hours</span>
            <span className={`detail-val ${isOpen ? 'text-green' : 'text-red'}`}>
              {isOpen ? 'Open now' : 'Closed'}
              {facility.openingHours.weekdayText?.[new Date().getDay()] && (
                <span className="hours-today">
                  {' — '}
                  {facility.openingHours.weekdayText[new Date().getDay()].split(': ')[1] ?? ''}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Distance */}
        {facility.distanceMetres != null && (
          <div className="detail-row">
            <span className="detail-label">Distance</span>
            <span className="detail-val">{(facility.distanceMetres / 1000).toFixed(1)} km</span>
          </div>
        )}

        {/* Phone */}
        {facility.phone && (
          <div className="detail-row">
            <span className="detail-label">Phone</span>
            <a href={`tel:${facility.phone}`} className="detail-link">{facility.phone}</a>
          </div>
        )}

        {/* Last updated */}
        {facility.edWaitData?.lastUpdated && (
          <div className="detail-row">
            <span className="detail-label">Last updated</span>
            <span className="detail-val detail-muted">
              {formatRelativeTime(facility.edWaitData.lastUpdated)}
            </span>
          </div>
        )}
      </div>

      {/* Alert subscription (hospitals only) */}
      {facility.type === 'hospital' && (
        <div className="alert-section">
          <p className="alert-title">Notify me when wait drops below</p>
          {!existingAlert && (
            <div className="alert-presets">
              {ALERT_PRESETS.map((mins) => (
                <button
                  key={mins}
                  className={`preset-btn ${alertThreshold === mins ? 'active' : ''}`}
                  onClick={() => setAlertThreshold(mins)}
                >
                  {formatWait(mins)}
                </button>
              ))}
            </div>
          )}
          <button
            className={`alert-btn ${existingAlert ? 'active' : ''}`}
            onClick={handleAlertToggle}
            disabled={alertLoading}
          >
            {alertLoading
              ? 'Saving…'
              : existingAlert
              ? `Alert set — ${formatWait(existingAlert.thresholdMinutes)} · Remove`
              : `Set alert for ${formatWait(alertThreshold)}`}
          </button>
        </div>
      )}

      {/* Directions button */}
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="directions-btn"
      >
        Get directions in Google Maps ↗
      </a>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diffSecs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSecs < 60) return 'Just now';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} min ago`;
  return `${Math.floor(diffSecs / 3600)}h ago`;
}
