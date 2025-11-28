// Intelligent Push Notification Service
// Works with PWA on iOS 16.4+ and all modern browsers

export interface SmartNotification {
  id: string;
  type: 'task_due' | 'task_overdue' | 'reminder' | 'insight' | 'weekly_summary';
  title: string;
  body: string;
  data?: any;
  scheduledFor?: Date;
  priority: 'low' | 'medium' | 'high';
}

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported in this browser');
    return 'denied';
  }
  
  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    console.log('Notification permission granted');
    // Register service worker for background notifications
    await registerServiceWorker();
  }
  
  return permission;
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

// Register service worker
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

// Show a notification immediately
export async function showNotification(notification: SmartNotification): Promise<boolean> {
  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    await registration.showNotification(notification.title, {
      body: notification.body,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: notification.id,
      data: notification.data,
      vibrate: notification.priority === 'high' ? [200, 100, 200] : [100],
      requireInteraction: notification.priority === 'high',
      silent: notification.priority === 'low',
      actions: getNotificationActions(notification.type),
    });
    
    return true;
  } catch (error) {
    // Fallback to regular Notification API
    try {
      new Notification(notification.title, {
        body: notification.body,
        icon: '/icon-192.png',
        tag: notification.id,
      });
      return true;
    } catch (e) {
      console.error('Failed to show notification:', e);
      return false;
    }
  }
}

// Get actions based on notification type
function getNotificationActions(type: SmartNotification['type']): NotificationAction[] {
  switch (type) {
    case 'task_due':
    case 'task_overdue':
      return [
        { action: 'complete', title: '✓ Completar' },
        { action: 'snooze', title: '⏰ Recordar luego' },
      ];
    case 'reminder':
      return [
        { action: 'open', title: '📖 Ver' },
        { action: 'dismiss', title: '✕ Descartar' },
      ];
    default:
      return [];
  }
}

// Smart notification scheduler
export class SmartNotificationScheduler {
  private checkInterval: number | null = null;
  private lastNotificationTime: Record<string, number> = {};
  private notificationsToday = 0;
  private lastResetDate: string = '';
  
  // Configuration for non-invasive notifications
  private config = {
    maxPerDay: 5,              // Maximum notifications per day
    minIntervalMinutes: 30,    // Minimum time between notifications
    quietHoursStart: 22,       // Don't notify after 10 PM
    quietHoursEnd: 8,          // Don't notify before 8 AM
    taskDueWarningHours: 24,   // Warn 24h before due date
    taskOverdueGracePeriod: 2, // Wait 2h after due before "overdue" notification
  };
  
  constructor() {
    this.loadState();
  }
  
  // Load persisted state
  private loadState() {
    try {
      const state = localStorage.getItem('notification_scheduler_state');
      if (state) {
        const parsed = JSON.parse(state);
        this.lastNotificationTime = parsed.lastNotificationTime || {};
        this.notificationsToday = parsed.notificationsToday || 0;
        this.lastResetDate = parsed.lastResetDate || '';
      }
      
      // Reset daily counter if it's a new day
      const today = new Date().toDateString();
      if (this.lastResetDate !== today) {
        this.notificationsToday = 0;
        this.lastResetDate = today;
        this.saveState();
      }
    } catch (e) {
      console.warn('Could not load notification state:', e);
    }
  }
  
  // Save state
  private saveState() {
    try {
      localStorage.setItem('notification_scheduler_state', JSON.stringify({
        lastNotificationTime: this.lastNotificationTime,
        notificationsToday: this.notificationsToday,
        lastResetDate: this.lastResetDate,
      }));
    } catch (e) {
      console.warn('Could not save notification state:', e);
    }
  }
  
  // Check if we can send a notification now
  private canNotify(notificationId: string): boolean {
    const now = new Date();
    const hour = now.getHours();
    
    // Check quiet hours
    if (hour >= this.config.quietHoursStart || hour < this.config.quietHoursEnd) {
      return false;
    }
    
    // Check daily limit
    if (this.notificationsToday >= this.config.maxPerDay) {
      return false;
    }
    
    // Check minimum interval for same notification
    const lastTime = this.lastNotificationTime[notificationId];
    if (lastTime) {
      const minutesSinceLast = (now.getTime() - lastTime) / (1000 * 60);
      if (minutesSinceLast < this.config.minIntervalMinutes) {
        return false;
      }
    }
    
    return true;
  }
  
  // Record that we sent a notification
  private recordNotification(notificationId: string) {
    this.lastNotificationTime[notificationId] = Date.now();
    this.notificationsToday++;
    this.saveState();
  }
  
  // Analyze tasks and generate smart notifications
  analyzeTasksForNotifications(tasks: Array<{
    id?: string;
    description: string;
    dueDate?: string;
    isDone: boolean;
    priority?: string;
    entryId?: string;
  }>): SmartNotification[] {
    const notifications: SmartNotification[] = [];
    const now = new Date();
    
    for (const task of tasks) {
      if (task.isDone || !task.dueDate) continue;
      
      const dueDate = new Date(task.dueDate);
      const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      const notificationId = `task-${task.id || task.description.slice(0, 20)}`;
      
      // Task is overdue
      if (hoursUntilDue < -this.config.taskOverdueGracePeriod) {
        const daysOverdue = Math.abs(Math.floor(hoursUntilDue / 24));
        notifications.push({
          id: `${notificationId}-overdue`,
          type: 'task_overdue',
          title: '⚠️ Tarea vencida',
          body: `"${task.description.slice(0, 50)}${task.description.length > 50 ? '...' : ''}" venció hace ${daysOverdue > 0 ? `${daysOverdue} día${daysOverdue > 1 ? 's' : ''}` : 'unas horas'}`,
          priority: 'high',
          data: { taskId: task.id, entryId: task.entryId },
        });
      }
      // Task is due soon (within warning period)
      else if (hoursUntilDue > 0 && hoursUntilDue <= this.config.taskDueWarningHours) {
        const isToday = dueDate.toDateString() === now.toDateString();
        const isTomorrow = dueDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
        
        let timeLabel = '';
        if (isToday) {
          const hours = Math.floor(hoursUntilDue);
          timeLabel = hours > 0 ? `en ${hours}h` : 'pronto';
        } else if (isTomorrow) {
          timeLabel = 'mañana';
        } else {
          timeLabel = `en ${Math.ceil(hoursUntilDue / 24)} días`;
        }
        
        notifications.push({
          id: `${notificationId}-due`,
          type: 'task_due',
          title: isToday ? '⏰ Tarea para hoy' : '📅 Tarea próxima',
          body: `"${task.description.slice(0, 50)}${task.description.length > 50 ? '...' : ''}" vence ${timeLabel}`,
          priority: isToday ? 'high' : 'medium',
          data: { taskId: task.id, entryId: task.entryId },
        });
      }
    }
    
    // Sort by priority
    return notifications.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  // Send smart notification if allowed
  async sendSmartNotification(notification: SmartNotification): Promise<boolean> {
    if (!this.canNotify(notification.id)) {
      return false;
    }
    
    const sent = await showNotification(notification);
    
    if (sent) {
      this.recordNotification(notification.id);
    }
    
    return sent;
  }
  
  // Start automatic checking (call this when app loads)
  startAutoCheck(getTasksFn: () => Array<{
    id?: string;
    description: string;
    dueDate?: string;
    isDone: boolean;
    priority?: string;
    entryId?: string;
  }>) {
    // Stop any existing interval
    this.stopAutoCheck();
    
    // Check every 30 minutes
    const checkTasks = async () => {
      if (Notification.permission !== 'granted') return;
      
      const tasks = getTasksFn();
      const notifications = this.analyzeTasksForNotifications(tasks);
      
      // Only send the highest priority notification
      if (notifications.length > 0) {
        await this.sendSmartNotification(notifications[0]);
      }
    };
    
    // Initial check after 5 seconds
    setTimeout(checkTasks, 5000);
    
    // Then check every 30 minutes
    this.checkInterval = window.setInterval(checkTasks, 30 * 60 * 1000);
  }
  
  // Stop automatic checking
  stopAutoCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  // Update configuration
  updateConfig(newConfig: Partial<typeof this.config>) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Singleton instance
export const notificationScheduler = new SmartNotificationScheduler();

