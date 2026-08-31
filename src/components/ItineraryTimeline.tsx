import { useEffect, useRef, useState } from 'react';
import { Plane, UtensilsCrossed, Camera, Building2, Compass, Clock, MapPin, CalendarDays, Radio, AlertTriangle, ExternalLink, Car, TrainFront, Footprints, Bike, Bus, ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { translations, type TranslationKey } from '../i18n/translations';
import { api } from '../services/api';
import BookingWebView from './BookingWebView';
import type { Plan, PlanItem, PlanItemCategory, ActivityStatus, RestaurantOption } from '../types';

// 可展开文本：长文默认按行数压缩（line-clamp），溢出时尾部出现倒三角展开键，
// 点击展开全文/再点收起。文本不超行时不显示按钮（scrollHeight 对比 clientHeight 检测）。
// clamp 用内联 -webkit-line-clamp 实现而非 Tailwind 类——动态拼接类名无法被 JIT 扫描到。
function ExpandableText({ text, clamp = 2, className = '' }: { text: string; clamp?: number; className?: string }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [overflowable, setOverflowable] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // 展开态不测量（此时无压缩，保留按钮供收起）；仅在压缩态检测是否真的溢出
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    setOverflowable(el.scrollHeight > el.clientHeight + 2);
  }, [text, clamp, expanded]);

  return (
    <div>
      <p
        ref={ref}
        className={className}
        style={
          expanded
            ? undefined
            : { display: '-webkit-box', WebkitLineClamp: clamp, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
        }
      >
        {text}
      </p>
      {overflowable && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 transition"
          aria-label={expanded ? t('collapseText') : t('expandText')}
        >
          {expanded ? t('collapseText') : t('expandText')}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

const categoryConfig: Record<PlanItemCategory, { icon: typeof Plane; color: string; bg: string; border: string; dot: string }> = {
  transport: { icon: Plane, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', dot: 'bg-sky-500' },
  food: { icon: UtensilsCrossed, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  sightseeing: { icon: Camera, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500' },
  lodging: { icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  activity: { icon: Compass, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
};

// 交通方式图标映射（0831）：key 为 adapter.normalizeTransportMode 的规范化结果。
// 城际段（高铁/航班/自驾）B 已带 details.mode；市内段 B 侧按距离分档回填后自动生效，
// 未回退方式的段保持汽车图标——与其当前的驾车时长口径一致，不会误导用户。
const transportModeConfig: Record<string, { icon: typeof Plane; labelKey: TranslationKey }> = {
  driving: { icon: Car, labelKey: 'modeDriving' },
  train: { icon: TrainFront, labelKey: 'modeTrain' },
  air: { icon: Plane, labelKey: 'modeAir' },
  walk: { icon: Footprints, labelKey: 'modeWalk' },
  riding: { icon: Bike, labelKey: 'modeRiding' },
  transit: { icon: Bus, labelKey: 'modeTransit' },
  taxi: { icon: Car, labelKey: 'modeTaxi' },
};

// 跳转目标统一用高德地图搜索（Google Maps/Booking.com 在国内无法访问，点击表现为无反应）
// transport 段名称是「A → B」，搜索目的地 B；带上城市名提高 POI 命中率
function getBookingUrl(category: PlanItemCategory, placeName: string, city: string): { url: string; labelKey: 'bookTransport' | 'bookFood' | 'bookSightseeing' | 'bookLodging' | 'bookActivity' } {
  let query = placeName.includes('→') ? placeName.split('→').pop()!.trim() : placeName;
  if (category === 'food') query += ' 餐厅';
  const keyword = city ? `${city}${query}` : query;
  const url = `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}`;
  switch (category) {
    case 'lodging':
      return { url, labelKey: 'bookLodging' };
    case 'food':
      return { url, labelKey: 'bookFood' };
    case 'transport':
      return { url, labelKey: 'bookTransport' };
    case 'sightseeing':
      return { url, labelKey: 'bookSightseeing' };
    default:
      return { url, labelKey: 'bookActivity' };
  }
}

function statusOf(item: PlanItem, activeItemId?: string, affectedItemIds: string[] = []): ActivityStatus | 'affected' {
  if (activeItemId && item.id === activeItemId) return 'active';
  if (affectedItemIds.includes(item.id)) return 'affected';
  return 'upcoming';
}

// 餐段候选选择器：点「更多餐厅」以当前餐段坐标为锚点调 B 侧 food 工具拉附近候选，
// 用户点选后 onSelectMeal 把选中餐厅写回行程（本地覆盖，A 侧不感知）
function MealPicker({ item, city, onSelectMeal }: {
  item: PlanItem;
  city?: string;
  onSelectMeal?: (itemId: string, option: RestaurantOption) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<RestaurantOption[] | null>(null);
  const [error, setError] = useState(false);

  const hasCoords = Number.isFinite(item.place.lat) && Number.isFinite(item.place.lng)
    && item.place.lat !== 0 && item.place.lng !== 0;
  if (!hasCoords || !onSelectMeal) return null;

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const opts = await api.fetchNearbyRestaurants(city || '北京', `${item.place.lng},${item.place.lat}`, 2000, 8);
      setOptions(opts);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && options === null && !loading) void load();
  };

  const pick = (opt: RestaurantOption) => {
    onSelectMeal(item.id, opt);
    setExpanded(false);
  };

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 transition text-[11px] font-medium"
      >
        <UtensilsCrossed className="w-3 h-3" />
        {expanded ? t('mealOptionsHide') : t('mealOptions')}
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-2 rounded-xl border border-orange-100 bg-orange-50/40 overflow-hidden">
          {loading && (
            <div className="px-3 py-3 text-[11px] text-slate-500 animate-pulse">{t('mealOptionsLoading')}</div>
          )}
          {!loading && error && (
            <button onClick={() => void load()} className="w-full text-left px-3 py-3 text-[11px] text-amber-700 hover:bg-orange-100/50">
              {t('mealOptionsError')}
            </button>
          )}
          {!loading && !error && options !== null && options.length === 0 && (
            <div className="px-3 py-3 text-[11px] text-slate-500">{t('mealOptionsEmpty')}</div>
          )}
          {!loading && !error && options?.map((opt) => {
            const isCurrent = opt.name === item.place.name;
            return (
              <button
                key={`${opt.name}-${opt.location}`}
                onClick={() => pick(opt)}
                className={`w-full text-left px-3 py-2 transition border-t border-orange-100/60 first:border-t-0 ${
                  isCurrent ? 'bg-orange-100/50' : 'hover:bg-orange-100/60'
                }`}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700 min-w-0 break-words">{opt.name}</span>
                  {isCurrent && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 text-[10px] font-bold">{t('mealCurrent')}</span>
                  )}
                  {opt.open ? (
                    <span className="flex-shrink-0 ml-auto text-[10px] text-emerald-600 font-medium">{t('mealOpen')}</span>
                  ) : (
                    <span className="flex-shrink-0 ml-auto text-[10px] text-slate-400 font-medium">{t('mealClosed')}</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  {opt.cuisine && <span>{opt.cuisine}</span>}
                  {opt.price_per_person > 0 && <span>{t('mealAvg')}{Math.round(opt.price_per_person)}</span>}
                  {opt.rating > 0 && <span>{t('mealRating')} {opt.rating}</span>}
                  {opt.distance_km != null && <span>{opt.distance_km}{t('mealKm')}</span>}
                </div>
                {opt.specialty && (
                  <div className="text-[10px] text-slate-400 mt-0.5 break-words">{opt.specialty}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimelineCard({ item, index, activeItemId, affectedItemIds, city, onSelectMeal }: { item: PlanItem; index: number; activeItemId?: string; affectedItemIds?: string[]; city?: string; onSelectMeal?: (itemId: string, option: RestaurantOption) => void }) {
  const { t, lang } = useI18n();
  const cfg = categoryConfig[item.place.category];
  const Icon = cfg.icon;
  const status = statusOf(item, activeItemId, affectedItemIds);
  const isAffected = status === 'affected';
  const isActive = status === 'active';
  const booking = getBookingUrl(item.place.category, item.place.name, city ?? '');
  // 应用内 WebView 打开高德订票：左上角返回按钮始终可见，用户不会被"困"在高德页面
  const [bookingView, setBookingView] = useState<{ url: string; title: string } | null>(null);

  // transport 段渲染为竞品式轻量通勤行：方式图标（高铁/航班/驾车/步行/骑行/公交）+ 起点→终点 + 距离·时长
  if (item.place.category === 'transport') {
    const modeCfg = item.transport_mode ? transportModeConfig[item.transport_mode] : undefined;
    const ModeIcon = modeCfg?.icon ?? Car;
    return (
      <div className="relative pl-10 pb-6 last:pb-0 group">
        <div className={`absolute left-[18px] top-0 bottom-0 w-px ${isAffected ? 'bg-amber-300' : 'bg-slate-200'} group-last:bottom-auto`} />
        <div className={`absolute left-[15px] top-3 w-2 h-2 rounded-full ${isAffected ? 'bg-amber-400' : 'bg-sky-400'} border-2 border-white`} />
        <div
          className={`py-2 px-3 rounded-xl border flex items-center gap-2 text-xs transition animate-fadeIn ${
            isAffected
              ? 'border-amber-300 bg-amber-50/60 text-amber-700'
              : 'border-sky-100 bg-sky-50/60 text-slate-500 hover:shadow-sm'
          } ${isActive ? 'ring-2 ring-teal-400/50' : ''}`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <span
            className="flex-shrink-0 inline-flex"
            title={modeCfg ? t(modeCfg.labelKey) : undefined}
            aria-label={modeCfg ? t(modeCfg.labelKey) : undefined}
          >
            <ModeIcon className={`w-3.5 h-3.5 ${isAffected ? 'text-amber-500' : 'text-sky-500'}`} />
          </span>
          {/* 站点对名称（「北京南站 → 上海虹桥站」）：不再 truncate——长名自动换行完整显示，
              此前被压成省略号且无任何途径看全文 */}
          <span className="font-medium min-w-0 break-words leading-snug">{item.place.name}</span>
          <span className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {item.distance_km != null && (
              <span className="flex items-center gap-1">
                {t('commuteApprox')}
                {item.distance_km}
                {t('approxKm')}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {item.duration_minutes} {t('minUnit')}
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
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
            {item.custom_meal && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold flex-shrink-0">
                <Check className="w-2.5 h-2.5" />
                {t('mealPicked')}
              </span>
            )}
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
        {/* 行程正文与简介：长文默认压缩为 2 行，倒三角展开（文本不长时无按钮） */}
        <ExpandableText text={item.activity} clamp={2} className="text-sm text-slate-600 mt-1 leading-relaxed" />
        {item.place.description && (
          <ExpandableText text={item.place.description} clamp={2} className="text-xs text-slate-500 mt-1 leading-relaxed" />
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
          <button
            onClick={() => setBookingView({ url: booking.url, title: item.place.name })}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition font-medium"
          >
            {translations[lang][booking.labelKey]}
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        {item.place.category === 'food' && (
          <MealPicker item={item} city={city} onSelectMeal={onSelectMeal} />
        )}
      </div>
    </div>
    {bookingView && (
      <BookingWebView
        url={bookingView.url}
        title={bookingView.title}
        onClose={() => setBookingView(null)}
      />
    )}
    </>
  );
}

interface ItineraryTimelineProps {
  plan: Plan | null;
  affectedItemIds?: string[];
  activeItemId?: string;
  onSelectMeal?: (itemId: string, option: RestaurantOption) => void;
}

export default function ItineraryTimeline({ plan, affectedItemIds, activeItemId, onSelectMeal }: ItineraryTimelineProps) {
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
                <TimelineCard key={item.id} item={item} index={idx} activeItemId={activeItemId} affectedItemIds={affectedItemIds} city={plan.destination} onSelectMeal={onSelectMeal} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
