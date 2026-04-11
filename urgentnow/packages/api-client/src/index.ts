import type {
  Facility,
  FacilitiesResponse,
  LatLng,
  FilterState,
  AlertSubscription,
} from '@urgentnow/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Facilities ──────────────────────────────────────────────────────────────

export async function fetchFacilities(
  location: LatLng,
  filters: Pick<FilterState, 'radiusKm' | 'showHospitals' | 'showUrgentCare' | 'showPharmacies'>
): Promise<FacilitiesResponse> {
  const params = new URLSearchParams({
    lat: String(location.lat),
    lng: String(location.lng),
    radius: String(filters.radiusKm * 1000), // metres
    hospitals: String(filters.showHospitals),
    urgentCare: String(filters.showUrgentCare),
    pharmacies: String(filters.showPharmacies),
  });
  const res = await fetch(`${BASE_URL}/api/facilities?${params}`);
  if (!res.ok) throw new Error(`Facilities fetch failed: ${res.status}`);
  return res.json();
}

// ─── ED Wait Times ────────────────────────────────────────────────────────────

export async function fetchEDWaitTimes(): Promise<
  Array<{ hospitalName: string; waitMinutes: number; patientsWaiting: number; patientsInDept: number; lastUpdated: string }>
> {
  const res = await fetch(`${BASE_URL}/api/ed-wait-times`);
  if (!res.ok) throw new Error(`ED wait fetch failed: ${res.status}`);
  return res.json();
}

// ─── Drive times (Routes API proxy) ──────────────────────────────────────────

export async function fetchDriveTime(
  origin: LatLng,
  destination: LatLng
): Promise<{ minutes: number; distanceMetres: number }> {
  const res = await fetch(`${BASE_URL}/api/drive-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
  });
  if (!res.ok) throw new Error(`Drive time fetch failed: ${res.status}`);
  return res.json();
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function createAlert(
  data: Omit<AlertSubscription, 'id' | 'createdAt'>
): Promise<AlertSubscription> {
  const res = await fetch(`${BASE_URL}/api/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create alert failed: ${res.status}`);
  return res.json();
}

export async function deleteAlert(alertId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/alerts/${alertId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete alert failed: ${res.status}`);
}

export async function fetchAlerts(userId: string): Promise<AlertSubscription[]> {
  const res = await fetch(`${BASE_URL}/api/alerts?userId=${userId}`);
  if (!res.ok) throw new Error(`Fetch alerts failed: ${res.status}`);
  return res.json();
}

// ─── Sorting helpers (shared between web + mobile) ───────────────────────────

export function sortFacilities(
  facilities: Facility[],
  sortBy: FilterState['sortBy']
): Facility[] {
  return [...facilities].sort((a, b) => {
    if (sortBy === 'distance') {
      return (a.distanceMetres ?? Infinity) - (b.distanceMetres ?? Infinity);
    }
    if (sortBy === 'waitTime') {
      const aWait = a.edWaitData?.waitMinutes ?? Infinity;
      const bWait = b.edWaitData?.waitMinutes ?? Infinity;
      return aWait - bWait;
    }
    if (sortBy === 'openNow') {
      const aOpen = a.openingHours?.openNow ? 0 : 1;
      const bOpen = b.openingHours?.openNow ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return (a.distanceMetres ?? Infinity) - (b.distanceMetres ?? Infinity);
    }
    return 0;
  });
}

export function filterFacilities(
  facilities: Facility[],
  filters: FilterState
): Facility[] {
  return facilities.filter((f) => {
    if (f.type === 'hospital' && !filters.showHospitals) return false;
    if (f.type === 'urgentCare' && !filters.showUrgentCare) return false;
    if (f.type === 'pharmacy' && !filters.showPharmacies) return false;
    if (filters.openNowOnly && !f.openingHours?.openNow) return false;
    if (f.distanceMetres != null && f.distanceMetres > filters.radiusKm * 1000) return false;
    return true;
  });
}
