import { useState, useEffect, useCallback } from 'react';
import { createAlert, deleteAlert, fetchAlerts } from '@urgentnow/api-client';
import type { AlertSubscription } from '@urgentnow/types';

const USER_ID_KEY = 'urgentnow:userId';

function getOrCreateUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = `user_${crypto.randomUUID()}`;
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertSubscription[]>([]);
  const [userId] = useState(getOrCreateUserId);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    fetchAlerts(userId).then(setAlerts).catch(console.error);
  }, [userId]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    return result === 'granted';
  }, []);

  const subscribe = useCallback(
    async (hospitalId: string, hospitalName: string, thresholdMinutes: number) => {
      if (notifPermission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return null;
      }
      const alert = await createAlert({
        userId,
        hospitalId,
        hospitalName,
        thresholdMinutes,
        active: true,
      });
      setAlerts((prev) => [...prev, alert]);
      return alert;
    },
    [userId, notifPermission, requestPermission]
  );

  const unsubscribe = useCallback(async (alertId: string) => {
    await deleteAlert(alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const getAlertForHospital = useCallback(
    (hospitalId: string) => alerts.find((a) => a.hospitalId === hospitalId && a.active),
    [alerts]
  );

  return { alerts, userId, notifPermission, subscribe, unsubscribe, getAlertForHospital };
}
