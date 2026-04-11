import { Router } from 'express';
import { z } from 'zod';

export const driveTimeRouter = Router();

const latLng = z.object({ lat: z.number(), lng: z.number() });
const bodySchema = z.object({ origin: latLng, destination: latLng });

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY!;

driveTimeRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const { origin, destination } = parsed.data;

  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    routeModifiers: { avoidFerries: false },
    languageCode: 'en-AU',
    units: 'METRIC',
  };

  const response = await fetch(ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return res.status(502).json({ error: 'Routes API error' });
  }

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) return res.status(404).json({ error: 'No route found' });

  const durationSecs = parseInt(route.duration?.replace('s', '') ?? '0', 10);

  res.json({
    minutes: Math.round(durationSecs / 60),
    distanceMetres: route.distanceMeters ?? 0,
  });
});
