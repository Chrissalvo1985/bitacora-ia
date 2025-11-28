// Service Worker for Bitácora IA
// Handles push notifications and background sync

const CACHE_NAME = 'bitacora-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  event.waitUntil(clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  // Handle different actions
  if (action === 'complete') {
    // Open app and mark task as complete
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // If app is already open, focus it and send message
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({
              type: 'COMPLETE_TASK',
              taskId: data.taskId,
              entryId: data.entryId,
            });
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow('/?action=complete&taskId=' + data.taskId);
        }
      })
    );
  } else if (action === 'snooze') {
    // Snooze for 1 hour - will re-notify later
    console.log('Task snoozed for 1 hour');
  } else {
    // Default: just open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});

// Handle push messages (for future server-side push)
self.addEventListener('push', (event) => {
  console.log('Push received:', event);
  
  let data = {
    title: 'Bitácora IA',
    body: 'Tienes una notificación',
    icon: '/icon-192.png',
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // This would sync any offline task changes
  console.log('Syncing tasks in background...');
}

