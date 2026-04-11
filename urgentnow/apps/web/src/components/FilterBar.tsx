'use client';

import type { FilterState } from '@urgentnow/types';

interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

const CHIPS = [
  { key: 'showHospitals' as const, label: 'Emergency rooms', color: '#E63946', bg: '#FEE2E2', text: '#B91C1C' },
  { key: 'showUrgentCare' as const, label: 'Urgent care', color: '#F59E0B', bg: '#FEF3C7', text: '#92400E' },
  { key: 'showPharmacies' as const, label: 'Pharmacies', color: '#10B981', bg: '#D1FAE5', text: '#065F46' },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const toggle = (key: keyof Pick<FilterState, 'showHospitals' | 'showUrgentCare' | 'showPharmacies'>) => {
    onChange({ ...filters, [key]: !filters[key] });
  };

  return (
    <div className="filter-bar">
      <div className="filter-chips">
        {CHIPS.map((chip) => (
          <button
            key={chip.key}
            className={`filter-chip ${!filters[chip.key] ? 'off' : ''}`}
            style={
              filters[chip.key]
                ? { background: chip.bg, color: chip.text, borderColor: chip.color + '66' }
                : {}
            }
            onClick={() => toggle(chip.key)}
          >
            <span
              className="chip-dot"
              style={{ background: chip.color, opacity: filters[chip.key] ? 1 : 0.35 }}
            />
            {chip.label}
          </button>
        ))}
      </div>

      <div className="radius-row">
        <span className="radius-label">Radius</span>
        <input
          type="range"
          min={1}
          max={25}
          step={1}
          value={filters.radiusKm}
          onChange={(e) => onChange({ ...filters, radiusKm: Number(e.target.value) })}
          className="radius-slider"
        />
        <span className="radius-val">{filters.radiusKm} km</span>
      </div>
    </div>
  );
}
