import cron from 'node-cron';
import { getCachedEDData, redis } from '../services/cache';
import type { AlertSubscription } from '@urgentnow/types';
import * as admin from 'firebase-admin';

// Initialise Firebase Admin once
if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

async function getAllActiveAlerts(): Promise<AlertSubscription[]> {
  // Scan for all alert keys — in production replace with a DB query
  const keys = await redis.keys('urgentnow:alert:*');
  if (keys.length === 0) return [];

  const pipeline = redis.pipeline();
  keys.forEach((k) => pipeline.get(k));
  const results = await pipeline.exec();

  const alerts: AlertSubscription[] = [];
  results?.forEach(([err, val]) => {
    if (!err && val) {
      try {
        const a = JSON.parse(String(val)) as AlertSubscription;
        if (a.active) alerts.push(a);
      } catch {}
    }
  });
  return alerts;
}

async function sendPush(userId: string, title: string, body: string) {
  // Retrieve the user's FCM token from Redis (stored when user grants notification permission)
  const token = await redis.get(`urgentnow:fcm:${userId}`);
  if (!token || !admin.apps.length) return;

  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (err) {
    console.error(`[Alerts] FCM send failed for user ${userId}:`, err);
  }
}

export function startAlertJob() {
  const run = async () => {
    const edData = await getCachedEDData();
    if (!edData || edData.length === 0) return;

    const alerts = await getAllActiveAlerts();
    if (alerts.length === 0) return;

    for (const alert of alerts) {
      const hospital = edData.find(
        (h) =>
          h.hospitalName.toLowerCase().includes(alert.hospitalName.toLowerCase().split(' ')[0]) ||
          alert.hospitalName.toLowerCase().includes(h.hospitalName.toLowerCase().split(' ')[0])
      );
      if (!hospital) continue;

      const stateKey = `urgentnow:alert:state:${alert.id}`;
      const lastState = (await redis.get(stateKey)) ?? 'above';
      const nowBelow = hospital.waitMinutes <= alert.thresholdMinutes;

      if (nowBelow && lastState === 'above') {
        // Threshold just crossed — fire push
        await sendPush(
          alert.userId,
          `Wait dropped at ${hospital.hospitalName}`,
          `Now ${hospital.waitMinutes} min — under your ${alert.thresholdMinutes} min alert`
        );
        await redis.set(stateKey, 'below', 'EX', 3600); // expire state after 1hr
        console.log(
          `[Alerts] Fired for user=${alert.userId} hospital=${hospital.hospitalName} wait=${hospital.waitMinutes}min`
        );
      } else {
        await redis.set(stateKey, nowBelow ? 'below' : 'above', 'EX', 3600);
      }
    }
  };

  cron.schedule('*/2 * * * *', run);
  console.log('[Alert Job] Started — checking thresholds every 2 min');
}
