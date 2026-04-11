/**
 * Google Places API (New) — Nearby Search
 * Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search
 */

import type { Facility, FacilityType, LatLng } from '@urgentnow/types';

const PLACES_BASE = 'https://places.googleapis.com/v1/places';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

// Field mask — only request what we need to minimise billing
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.currentOpeningHours',
  'places.businessStatus',
].join(',');

interface PlacesSearchParams {
  location: LatLng;
  radiusMetres: number;
  includedTypes: string[];
}

export async function searchNearbyPlaces(
  params: PlacesSearchParams
): Promise<Facility[]> {
  const body = {
    includedTypes: params.includedTypes,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: params.location.lat, longitude: params.location.lng },
        radius: params.radiusMetres,
      },
    },
  };

  const res = await fetch(`${PLACES_BASE}:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const places = data.places ?? [];
  return places
    .filter((p: GooglePlace) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((p: GooglePlace) => placeToFacility(p, params.includedTypes));
}

// Fetch all three facility types in parallel
export async function fetchAllFacilities(
  location: LatLng,
  radiusMetres: number,
  opts: { hospitals: boolean; urgentCare: boolean; pharmacies: boolean }
): Promise<Facility[]> {
  const requests: Promise<Facility[]>[] = [];

  if (opts.hospitals) {
    requests.push(
      searchNearbyPlaces({ location, radiusMetres, includedTypes: ['hospital', 'emergency_room'] })
    );
  }
  if (opts.urgentCare) {
    requests.push(
      searchNearbyPlaces({ location, radiusMetres, includedTypes: ['urgent_care_center'] })
    );
  }
  if (opts.pharmacies) {
    requests.push(
      searchNearbyPlaces({ location, radiusMetres, includedTypes: ['pharmacy', 'drugstore'] })
    );
  }

  const results = await Promise.allSettled(requests);
  const all: Facility[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
    else console.error('Places fetch error:', r.reason);
  }

  // Deduplicate by placeId
  const seen = new Set<string>();
  return all.filter((f) => {
    if (seen.has(f.placeId)) return false;
    seen.add(f.placeId);
    return true;
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: GoogleOpeningHours;
  currentOpeningHours?: GoogleOpeningHours & { openNow?: boolean };
  businessStatus?: string;
}

interface GoogleOpeningHours {
  weekdayDescriptions?: string[];
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
}

function placeToFacility(p: GooglePlace, includedTypes: string[]): Facility {
  return {
    id: p.id,
    placeId: p.id,
    type: inferType(includedTypes),
    name: p.displayName?.text ?? 'Unknown',
    address: p.formattedAddress ?? '',
    location: {
      lat: p.location?.latitude ?? 0,
      lng: p.location?.longitude ?? 0,
    },
    phone: p.nationalPhoneNumber,
    website: p.websiteUri,
    rating: p.rating,
    ratingCount: p.userRatingCount,
    openingHours: p.currentOpeningHours || p.regularOpeningHours
      ? {
          openNow: p.currentOpeningHours?.openNow ?? false,
          weekdayText: p.currentOpeningHours?.weekdayDescriptions ?? p.regularOpeningHours?.weekdayDescriptions ?? [],
          periods: p.regularOpeningHours?.periods,
        }
      : undefined,
  };
}

function inferType(types: string[]): FacilityType {
  if (types.some((t) => t.includes('hospital') || t.includes('emergency'))) return 'hospital';
  if (types.some((t) => t.includes('urgent'))) return 'urgentCare';
  return 'pharmacy';
}
