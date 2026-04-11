import { Router } from 'express';
import { z } from 'zod';
import { redis } from '../services/cache';
import { randomUUID } from 'crypto';
import type { AlertSubscription } from '@urgentnow/types';

export const alertsRouter = Router();

const createSchema = z.object({
  userId: z.string().min(1),
  hospitalId: z.string().min(1),
  hospitalName: z.string().min(1),
  thresholdMinutes: z.number().int().min(5).max(480),
  active: z.boolean().default(true),
});

function alertKey(id: string) { return `urgentnow:alert:${id}`; }
function userAlertsKey(userId: string) { return `urgentnow:alerts:user:${userId}`; }

alertsRouter.get('/', async (req, res) => {
  const userId = String(req.query.userId ?? '');
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const ids = await redis.smembers(userAlertsKey(userId));
  if (ids.length === 0) return res.json([]);

  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.get(alertKey(id)));
  const results = await pipeline.exec();

  const alerts: AlertSubscription[] = [];
  results?.forEach(([err, val]) => {
    if (!err && val) {
      try { alerts.push(JSON.parse(String(val))); } catch {}
    }
  });

  res.json(alerts);
});

alertsRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const alert: AlertSubscription = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...parsed.data,
  };

  await redis.set(alertKey(alert.id), JSON.stringify(alert));
  await redis.sadd(userAlertsKey(alert.userId), alert.id);

  res.status(201).json(alert);
});

alertsRouter.delete('/:id', async (req, res) => {
  const existing = await redis.get(alertKey(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Alert not found' });

  const alert: AlertSubscription = JSON.parse(existing);
  await redis.del(alertKey(alert.id));
  await redis.srem(userAlertsKey(alert.userId), alert.id);

  res.status(204).send();
});
