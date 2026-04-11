'use client';

import type { Facility, FilterState } from '@urgentnow/types';
import { FacilityCard } from './FacilityCard';

interface SidebarProps {
  facilities: Facility[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (f: Facility) => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
}

const SORT_OPTIONS: { value: FilterState['sortBy']; label: string }[] = [
  { value: 'distance', label: 'Nearest' },
  { value: 'waitTime', label: 'Shortest wait' },
  { value: 'openNow', label: 'Open now' },
];

export function Sidebar({
  facilities,
  loading,
  error,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Sort bar */}
      <div className="sort-bar">
        <span className="sort-label">Sort</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`sort-btn ${filters.sortBy === opt.value ? 'active' : ''}`}
            onClick={() => onFiltersChange({ ...filters, sortBy: opt.value })}
          >
            {opt.label}
          </button>
        ))}
        <label className="open-toggle">
          <input
            type="checkbox"
            checked={filters.openNowOnly}
            onChange={(e) => onFiltersChange({ ...filters, openNowOnly: e.target.checked })}
          />
          <span>Open now</span>
        </label>
      </div>

      {/* Results count */}
      <div className="results-header">
        {loading ? (
          <span className="results-count loading">Loading…</span>
        ) : error ? (
          <span className="results-count error">{error}</span>
        ) : (
          <span className="results-count">
            {facilities.length} {facilities.length === 1 ? 'result' : 'results'} within {filters.radiusKm} km
          </span>
        )}
      </div>

      {/* Facility list */}
      <div className="results-list">
        {loading && facilities.length === 0 && (
          <div className="skeleton-list">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
        )}

        {!loading && facilities.length === 0 && !error && (
          <div className="empty-state">
            <p>No facilities found in this area.</p>
            <p>Try increasing the search radius or adjusting filters.</p>
          </div>
        )}

        {facilities.map((facility) => (
          <FacilityCard
            key={facility.id}
            facility={facility}
            isSelected={facility.id === selectedId}
            onClick={() => onSelect(facility)}
          />
        ))}
      </div>
    </aside>
  );
}
