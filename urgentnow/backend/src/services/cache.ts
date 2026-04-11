import Redis from 'ioredis';
import type { EDHospitalData } from './edScraper';
import type { Facility } from '@urgentnow/types';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const KEYS = {
  edData: 'urgentnow:ed:data',
  facilities: (lat: number, lng: number, radius: number) =>
    `urgentnow:facilities:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`,
};

const TTL = {
  edData: 120,       // 2 minutes — WA Health updates roughly this frequently
  facilities: 300,   // 5 minutes — Places data doesn't change fast
};

// ─── ED data ─────────────────────────────────────────────────────────────────

export async function getCachedEDData(): Promise<EDHospitalData[] | null> {
  const raw = await redis.get(KEYS.edData);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function setCachedEDData(data: EDHospitalData[]): Promise<void> {
  await redis.setex(KEYS.edData, TTL.edData, JSON.stringify(data));
}

// ─── Facilities ───────────────────────────────────────────────────────────────

export async function getCachedFacilities(
  lat: number, lng: number, radius: number
): Promise<Facility[] | null> {
  const raw = await redis.get(KEYS.facilities(lat, lng, radius));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function setCachedFacilities(
  lat: number, lng: number, radius: number, data: Facility[]
): Promise<void> {
  await redis.setex(KEYS.facilities(lat, lng, radius), TTL.facilities, JSON.stringify(data));
}

export { redis };
