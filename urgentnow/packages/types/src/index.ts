// Facility types
export type FacilityType = 'hospital' | 'urgentCare' | 'pharmacy';

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface OpeningHours {
  openNow: boolean;
  weekdayText: string[];
  periods?: {
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }[];
}

export interface BusyTimes {
  /** 0–100 relative busyness score */
  currentBusyness: number | null;
  label: 'quiet' | 'not too busy' | 'a bit busy' | 'busy' | 'very busy' | null;
}

export interface EDWaitData {
  hospitalName: string;
  waitMinutes: number;
  patientsWaiting: number;
  patientsInDept: number;
  lastUpdated: string; // ISO string
}

export interface Facility {
  id: string;
  placeId: string;
  type: FacilityType;
  name: string;
  address: string;
  location: LatLng;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;

  // Distance computed client-side
  distanceMetres?: number;
  driveMinutes?: number;

  // Hours (from Places API)
  openingHours?: OpeningHours;

  // Busyness (from Places popular times)
  busyTimes?: BusyTimes;

  // ED-only (from WA Health feed)
  edWaitData?: EDWaitData;
}

export interface FacilitiesResponse {
  facilities: Facility[];
  fetchedAt: string;
}

// Triage
export interface TriageQuestion {
  id: string;
  text: string;
  options: TriageOption[];
}

export interface TriageOption {
  label: string;
  nextQuestionId?: string;
  result?: TriageResult;
}

export interface TriageResult {
  recommendation: FacilityType | 'ED_EMERGENCY';
  urgency: UrgencyLevel;
  reason: string;
  callTripleZero?: boolean;
}

// Alerts
export interface AlertSubscription {
  id: string;
  userId: string;
  hospitalId: string;
  hospitalName: string;
  thresholdMinutes: number;
  active: boolean;
  createdAt: string;
}

// Filters & sorting
export type SortBy = 'distance' | 'waitTime' | 'openNow';

export interface FilterState {
  showHospitals: boolean;
  showUrgentCare: boolean;
  showPharmacies: boolean;
  radiusKm: number;
  sortBy: SortBy;
  openNowOnly: boolean;
}
