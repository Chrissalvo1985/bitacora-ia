import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS } from '../constants';
import { useBitacora } from '../context/BitacoraContext';
import {
  isNotificationSupported,
  requestNotificationPermission,
  getNotificationPermission,
  notificationScheduler,
} from '../services/notificationService';

interface NotificationManagerProps {
  showBanner?: boolean;
}

const NotificationManager: React.FC<NotificationManagerProps> = memo(({ showBanner = true }) => {
  const { entries } = useBitacora();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check support and permission on mount
  useEffect(() => {
    const supported = isNotificationSupported();
    setIsSupported(supported);
    
    if (supported) {
      const currentPermission = getNotificationPermission();
      setPermission(currentPermission);
      
      // Show banner if permission is default and hasn't been dismissed
      const wasDismissed = localStorage.getItem('notification_banner_dismissed') === 'true';
      setDismissed(wasDismissed);
      
      if (currentPermission === 'default' && !wasDismissed) {
        // Show banner after a delay
        setTimeout(() => setShowPermissionBanner(true), 5000);
      }
    }
  }, []);

  // Get all tasks from entries - memoized to prevent unnecessary recalculations
  const allTasks = useMemo(() => {
    return entries.flatMap(entry => 
      entry.tasks.map(task => ({
        ...task,
        entryId: entry.id,
      }))
    );
  }, [entries]);

  // Start notification scheduler when permission is granted
  useEffect(() => {
    if (permission === 'granted') {
      notificationScheduler.startAutoCheck(() => allTasks);
      
      return () => {
        notificationScheduler.stopAutoCheck();
      };
    }
  }, [permission, allTasks]);

  // Handle permission request
  const handleRequestPermission = async () => {
    const newPermission = await requestNotificationPermission();
    setPermission(newPermission);
    setShowPermissionBanner(false);
    
    if (newPermission === 'granted') {
      // Show success message
      console.log('Notifications enabled!');
    }
  };

  // Dismiss banner
  const handleDismiss = () => {
    setShowPermissionBanner(false);
    setDismissed(true);
    localStorage.setItem('notification_banner_dismissed', 'true');
  };

  // Handle service worker messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'COMPLETE_TASK') {
        // TODO: Mark task as complete
        console.log('Complete task from notification:', event.data);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  if (!isSupported || !showBanner) return null;

  return (
    <AnimatePresence>
      {showPermissionBanner && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-4 text-white">
            <div className="flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <ICONS.Bell size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">¿Activar recordatorios?</h3>
                <p className="text-sm text-white/80 mb-3">
                  Te avisaré de tareas próximas a vencer de forma inteligente y poco invasiva.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRequestPermission}
                    className="px-4 py-2 bg-white text-indigo-600 rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors"
                  >
                    Activar
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2 bg-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/30 transition-colors"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-white/60 hover:text-white p-1"
              >
                <ICONS.X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default NotificationManager;
