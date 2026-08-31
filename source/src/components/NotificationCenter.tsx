import { useState } from 'react';
import {
  AlertTriangle,
  CloudRain,
  CalendarCheck,
  RefreshCw,
  Info,
  CheckCheck,
  Trash2,
  Sparkles,
  BellOff,
  ArrowLeft,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { translations } from '../i18n/translations';
import type { TravelNotification, NotificationType } from '../types';

const typeConfig: Record<NotificationType, { icon: typeof Info; color: string; bg: string; border: string }> = {
  delay: { icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  weather: { icon: CloudRain, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  booking: { icon: CalendarCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  plan_update: { icon: RefreshCw, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  info: { icon: Info, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
};

const priorityBar: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
};

interface NotificationCenterProps {
  notifications: TravelNotification[];
  onBack: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
  onSimulate: () => void;
}

export default function NotificationCenter({
  notifications,
  onBack,
  onMarkRead,
  onMarkAllRead,
  onClear,
  onSimulate,
}: NotificationCenterProps) {
  const { t, lang } = useI18n();
  const tr = translations[lang];
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const list = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return tr.justNow;
    if (mins < 60) return `${mins}${tr.mAgo}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${tr.hAgo}`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t('notifications')}</h2>
          <p className="text-xs text-slate-500">
            {unreadCount > 0 ? `${unreadCount} ${t('unreadSuffix')} · ` : ''}
            {t('notifSubtitle')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('filterAll')}
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              filter === 'unread' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('filterUnread')} {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={onSimulate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-medium hover:bg-teal-100 transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t('simulateUpdate')}
        </button>
        <button
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-medium hover:bg-slate-50 transition disabled:opacity-40"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          {t('readAll')}
        </button>
        <button
          onClick={onClear}
          disabled={notifications.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-medium hover:bg-slate-50 transition disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('clear')}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
            <BellOff className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm">{t('allCaughtUp')}</p>
          <p className="text-slate-400 text-xs mt-1">{t('newUpdatesInfo')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((n) => {
            const cfg = typeConfig[n.type];
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                onClick={() => !n.read && onMarkRead(n.id)}
                className={`relative bg-white rounded-xl border ${n.read ? 'border-slate-100' : 'border-slate-200 shadow-sm'} p-4 cursor-pointer hover:border-slate-300 transition group`}
              >
                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${priorityBar[n.priority]}`} />
                <div className="flex gap-3 pl-2">
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm ${n.read ? 'font-medium text-slate-600' : 'font-semibold text-slate-800'}`}>
                        {n.title}
                      </h4>
                      <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(n.timestamp)}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.color}`}>
                        {n.type.replace('_', ' ')}
                      </span>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-teal-500" />
                      )}
                      {n.action_label && (
                        <span className="text-xs font-medium text-teal-600 group-hover:underline">
                          {n.action_label} →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-slate-400 mt-6">{t('notifFooter')}</p>
    </div>
  );
}
