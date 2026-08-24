import type { TravelNotification, NotificationType } from '../types';
import type { Lang } from '../i18n/translations';
import seedNotificationsRaw from '../mock/data/notification.json';
import { LocalNotifications } from '@capacitor/local-notifications';

const seedNotifications = seedNotificationsRaw as TravelNotification[];

let permissionChecked = false;
let permissionGranted = false;

const STORAGE_KEY = 'voyageai_notifications_v1';

type Listener = (notifications: TravelNotification[]) => void;
type BannerListener = (n: TravelNotification) => void;
const listeners = new Set<Listener>();
const bannerListeners = new Set<BannerListener>();

function emit(notifications: TravelNotification[]) {
  listeners.forEach((l) => l(notifications));
}

function persist(notifications: TravelNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // storage may be unavailable (private mode); keep in-memory only
  }
  emit(notifications);
}

let cached: TravelNotification[] | null = null;

function load(): TravelNotification[] {
  if (cached) return cached;
  let result: TravelNotification[];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    result = raw ? (JSON.parse(raw) as TravelNotification[]) : [];
  } catch {
    result = [];
  }
  cached = result;
  return result;
}

const TEMPLATES: Record<NotificationType, Record<Lang, Omit<TravelNotification, 'id' | 'timestamp' | 'read'>>> = {
  delay: {
    en: {
      type: 'delay',
      priority: 'high',
      title: 'Schedule Disruption Detected',
      message: 'A transit delay was detected. The agent is re-optimizing the affected day.',
      action_label: 'View updated plan',
    },
    zh: {
      type: 'delay',
      priority: 'high',
      title: '行程变动检测',
      message: '检测到交通延误。智能体正在重新优化受影响的日程。',
      action_label: '查看更新',
    },
  },
  weather: {
    en: {
      type: 'weather',
      priority: 'medium',
      title: 'Weather Alert',
      message: 'Weather conditions changed for an upcoming activity. The agent prepared an alternative.',
      action_label: 'Review suggestion',
    },
    zh: {
      type: 'weather',
      priority: 'medium',
      title: '天气预警',
      message: '即将进行的活动天气条件有变。智能体已准备替代方案。',
      action_label: '查看建议',
    },
  },
  booking: {
    en: {
      type: 'booking',
      priority: 'low',
      title: 'Booking Update',
      message: 'A reservation status was updated by the agent.',
    },
    zh: {
      type: 'booking',
      priority: 'low',
      title: '预订更新',
      message: '智能体更新了一项预订状态。',
    },
  },
  plan_update: {
    en: {
      type: 'plan_update',
      priority: 'high',
      title: 'Itinerary Updated',
      message: 'The agent revised your itinerary based on real-time conditions.',
      action_label: 'See changes',
    },
    zh: {
      type: 'plan_update',
      priority: 'high',
      title: '行程已更新',
      message: '智能体根据实时情况修改了你的行程。',
      action_label: '查看变更',
    },
  },
  info: {
    en: {
      type: 'info',
      priority: 'low',
      title: 'Agent Note',
      message: 'The agent recorded an observation about your trip.',
    },
    zh: {
      type: 'info',
      priority: 'low',
      title: '智能体备注',
      message: '智能体记录了一条关于你旅行的观察。',
    },
  },
};

export const notificationService = {
  getAll(): TravelNotification[] {
    return load();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(load());
    return () => listeners.delete(listener);
  },

  onBanner(listener: BannerListener): () => void {
    bannerListeners.add(listener);
    return () => bannerListeners.delete(listener);
  },

  add(notification: TravelNotification): void {
    const all = load();
    persist([notification, ...all]);
  },

  markRead(id: string): void {
    const all = load().map((n) => (n.id === id ? { ...n, read: true } : n));
    persist(all);
  },

  markAllRead(): void {
    const all = load().map((n) => ({ ...n, read: true }));
    persist(all);
  },

  clear(): void {
    persist([]);
  },

  unreadCount(): number {
    return load().filter((n) => !n.read).length;
  },

  simulateIncoming(type: NotificationType = 'plan_update', affectedItemId?: string, lang: Lang = 'zh'): TravelNotification {
    const template = TEMPLATES[type][lang];
    const notification: TravelNotification = {
      ...template,
      id: `ntf_${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
      affected_item_id: affectedItemId,
    };
    this.add(notification);
    this.sendLocalNotification(notification);
    bannerListeners.forEach((l) => l(notification));
    return notification;
  },

  async sendLocalNotification(n: TravelNotification): Promise<void> {
    try {
      // 权限缓存：只检查一次，避免重复请求造成延迟
      if (!permissionChecked) {
        const perm = await LocalNotifications.requestPermissions();
        permissionChecked = true;
        permissionGranted = perm.display === 'granted';
      }
      if (!permissionGranted) return;

      const notifId = Math.floor(Date.now() / 1000) % 100000;
      // 立即发送，不设延迟
      await LocalNotifications.schedule({
        notifications: [
          {
            title: n.title,
            body: n.message,
            id: notifId,
            smallIcon: 'ic_launcher',
            channelId: 'travel-updates',
          },
        ],
      });
    } catch {
      // Capacitor not available (web build) — silently skip
    }
  },

  async initNativePush(onReceived?: (n: TravelNotification) => void): Promise<void> {
    try {
      const perm = await LocalNotifications.requestPermissions();
      permissionChecked = true;
      permissionGranted = perm.display === 'granted';
      if (!permissionGranted) return;

      await LocalNotifications.addListener('localNotificationReceived', (event) => {
        const n: TravelNotification = {
          id: `ntf_${Date.now()}`,
          type: 'plan_update',
          priority: 'high',
          title: event.title ?? 'Travel Update',
          message: event.body ?? '',
          timestamp: new Date().toISOString(),
          read: false,
        };
        this.add(n);
        if (onReceived) onReceived(n);
      });
    } catch {
      // Capacitor not available (web build) — silently skip
    }
  },
};
