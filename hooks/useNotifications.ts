import { useState, useEffect, useCallback } from 'react';
import {
  isNotificationSupported,
  requestNotificationPermission,
  getNotificationPermission,
  notificationScheduler,
} from '../services/notificationService';

// Hook for using notifications in other components
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(isNotificationSupported());
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    }
  }, []);

  const requestPermission = useCallback(async () => {
    const newPermission = await requestNotificationPermission();
    setPermission(newPermission);
    return newPermission;
  }, []);

  return {
    isSupported,
    permission,
    isEnabled: permission === 'granted',
    requestPermission,
    scheduler: notificationScheduler,
  };
}

