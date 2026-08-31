import { Plane, UtensilsCrossed, Camera, Building2, Compass, Clock, MapPin, CalendarDays, Radio, AlertTriangle, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { translations } from '../i18n/translations';
import type { Plan, PlanItem, PlanItemCategory, ActivityStatus } from '../types';

const categoryConfig: Record<PlanItemCategory, { icon: typeof Plane; color: string; bg: string; border: string; dot: string }> = {
  transport: { icon: Plane, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', dot: 'bg-sky-500' },
  food: { icon: UtensilsCrossed, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  sightseeing: { icon: Camera, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' },
  lodging: { icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  activity: { icon: Compass, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
};

function getBookingUrl(category: PlanItemCategory, placeName: string): { url: string; labelKey: 'bookTransport' | 'bookFood' | 'bookSightseeing' | 'bookLodging' | 'bookActivity' } {
  const query = encodeURIComponent(placeName);
  switch (category) {
    case 'lodging':
      return { url: `https://www.booking.com/searchresults.html?ss=${query}`, labelKey: 'bookLodging' };
    case 'food':
      return { url: `https://www.google.com/maps/search/${query}+restaurant`, labelKey: 'bookFood' };
    case 'transport':
      return { url: `https://www.google.com/maps/search/${query}+station`, labelKey: 'bookTransport' };
    case 'sightseeing':
      return { url: `https://www.google.com/maps/search/${query}+tickets`, labelKey: 'bookSightseeing' };
    default:
      return { url: `https://www.google.com/maps/search/${query}`, labelKey: 'bookActivity' };
  }
}

function statusOf(item: PlanItem, activeItemId?: string, affectedItemIds: string[] = []): ActivityStatus | 'affected' {
  if (activeItemId && item.id === activeItemId) return 'active';
  if (affectedItemIds.includes(item.id)) return 'affected';
  return 'upcoming';
}

function TimelineCard({ item, index, activeItemId, affectedItemIds }: { item: PlanItem; index: number; activeItemId?: string; affectedItemIds?: string[] }) {
  const { t, lang } = useI18n();
  const cfg = categoryConfig[item.place.category];
  const Icon = cfg.icon;
  const status = statusOf(item, activeItemId, affectedItemIds);
  const isAffected = status === 'affected';
  const isActive = status === 'active';
  const booking = getBookingUrl(item.place.category, item.place.name);

  return (
    <div className="relative pl-10 pb-6 last:pb-0 group">
      <div className={`absolute left-[18px] top-0 bottom-0 w-px ${isAffected ? 'bg-amber-300' : 'bg-slate-200'} group-last:bottom-auto`} />
      <div className={`absolute left-0 top-1 w-9 h-9 rounded-full ${cfg.bg} border-2 ${isAffected ? 'border-amber-300' : cfg.border} flex items-center justify-center ${cfg.color} ${isActive ? 'ring-4 ring-teal-400/30' : ''}`}>
        <Icon className="w-4 h-4" />
        {isActive && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-teal-500 border-2 border-white animate-pulse" />
        )}
      </div>

      <div
        className={`p-4 rounded-xl border transition animate-fadeIn ${
          isAffected ? 'border-amber-300 bg-amber-50/60' : isActive ? 'border-teal-300 bg-teal-50/40' : `${cfg.border} ${cfg.bg}`
        } hover:shadow-sm`}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
            {item.place.name}
            {isAffected && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          </h4>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isActive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold uppercase">
                <Radio className="w-2.5 h-2.5" />
                {t('live')}
              </span>
            )}
            {isAffected && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">
                {t('updatedBadge')}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {item.time}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.activity}</p>
        {item.place.description && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.place.description}</p>
        )}
        <div className="flex items-center justify-between gap-4 mt-2 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {item.place.name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.duration_minutes} {t('minUnit')}
            </span>
            {item.cost_estimate > 0 && (
              <span className="flex items-center gap-1">
                ¥{item.cost_estimate}
              </span>
            )}
          </div>
          <a
            href={booking.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition font-medium"
          >
            {translations[lang][booking.labelKey]}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

interface ItineraryTimelineProps {
  plan: Plan | null;
  affectedItemIds?: string[];
  activeItemId?: string;
}

export default function ItineraryTimeline({ plan, affectedItemIds, activeItemId }: ItineraryTimelineProps) {
  const { t } = useI18n();

  if (!plan) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
          <CalendarDays className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-slate-400 text-sm">{t('itineraryPlaceholder')}</p>
      </div>
    );
  }

  const days = [...new Set(plan.items.map((i) => i.day))].sort((a, b) => a - b);
  const affectedCount = plan.items.filter((i) => affectedItemIds?.includes(i.id)).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{plan.destination}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {plan.start_date} → {plan.end_date} · {plan.travelers} {t('travelersSuffix')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
              {plan.items.length} {t('activities')}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
              {days.length} {t('days')}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
              ¥{plan.total_cost_estimate} {t('est')}
            </span>
            {affectedCount > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {affectedCount} {t('updated')}
              </span>
            )}
          </div>
        </div>
      </div>

      {days.map((day) => {
        const dayItems = plan.items.filter((i) => i.day === day);
        const dayAffected = dayItems.filter((i) => affectedItemIds?.includes(i.id)).length;
        return (
          <div key={day} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white text-sm font-bold flex items-center justify-center">
                {day}
              </div>
              <h3 className="font-semibold text-slate-700">{t('dayLabel')} {day}{t('daySuffix')}</h3>
              {dayAffected > 0 && (
                <span className="text-xs text-amber-600 font-medium">{dayAffected} {t('itemsRevised')}</span>
              )}
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div>
              {dayItems.map((item, idx) => (
                <TimelineCard key={item.id} item={item} index={idx} activeItemId={activeItemId} affectedItemIds={affectedItemIds} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
