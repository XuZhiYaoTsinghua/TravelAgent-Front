import { Bell } from 'lucide-react';
import type { TravelNotification } from '../types';

interface NotificationBellProps {
  notifications: TravelNotification[];
  active: boolean;
  onClick: () => void;
}

export default function NotificationBell({ notifications, active, onClick }: NotificationBellProps) {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <button
      onClick={onClick}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition border ${
        active
          ? 'bg-teal-50 border-teal-200 text-teal-700'
          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
      }`}
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-fadeIn">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
