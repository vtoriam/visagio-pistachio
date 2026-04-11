import { Router } from 'express';
import { z } from 'zod';
import { fetchAllFacilities } from '../services/placesService';
import { getCachedEDData, getCachedFacilities, setCachedFacilities } from '../services/cache';
import type { Facility } from '@urgentnow/types';

export const facilitiesRouter = Router();

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(500).max(50000).default(10000),
  hospitals: z.coerce.boolean().default(true),
  urgentCare: z.coerce.boolean().default(true),
  pharmacies: z.coerce.boolean().default(true),
});

facilitiesRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query params', details: parsed.error.flatten() });
  }

  const { lat, lng, radius, hospitals, urgentCare, pharmacies } = parsed.data;

  // Check facilities cache
  const cached = await getCachedFacilities(lat, lng, radius);
  let facilities: Facility[];

  if (cached) {
    facilities = cached;
  } else {
    facilities = await fetchAllFacilities(
      { lat, lng },
      radius,
      { hospitals, urgentCare, pharmacies }
    );
    await setCachedFacilities(lat, lng, radius, facilities);
  }

  // Merge live ED wait times into hospital entries
  const edData = await getCachedEDData();
  if (edData && edData.length > 0) {
    facilities = facilities.map((f) => {
      if (f.type !== 'hospital') return f;
      // Fuzzy match by name
      const match = edData.find((ed) =>
        f.name.toLowerCase().includes(ed.hospitalName.toLowerCase().split(' ')[0]) ||
        ed.hospitalName.toLowerCase().includes(f.name.toLowerCase().split(' ')[0])
      );
      if (!match) return f;
      return { ...f, edWaitData: match };
    });
  }

  res.json({ facilities, fetchedAt: new Date().toISOString() });
});
