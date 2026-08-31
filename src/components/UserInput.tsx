import { useEffect, useRef, useState } from 'react';
import { Send, MapPin, Users, Coins, Sparkles, X, Plus, MessageSquareText, PlaneTakeoff, PlaneLanding, Route, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { DatePickerField, TimePickerField } from './Pickers';
import type { TranslationKey } from '../i18n/translations';
import type { TransportPreference, UserRequest } from '../types';

// 假进度条（时间驱动）。
// 为什么不做真实进度：B 侧 Django 是同步框架，规划 POST 占住唯一 worker，
// 期间 /api/tool-calls/ 等所有并发请求全部阻塞（实测规划中轮询 100% 超时 4s+，
// 规划结束才一次性返回数据），前端在规划期永远拿不到增量信息。
// 因此改为体验曲线：0→30% 快速启动给即时反馈，之后指数渐近逼近 99% 永不到顶，
// 规划完成的瞬间 99→100%，停留 900ms 让用户看到完成态再淡出。
function fakeProgress(elapsedSec: number): number {
  if (elapsedSec <= 0) return 0;
  if (elapsedSec < 2) return (elapsedSec / 2) * 30;
  // Math.min 显式封顶：浮点渐近线即 99，保证任何时长都不会显示满格
  return Math.min(99, 30 + 69 * (1 - Math.exp(-(elapsedSec - 2) / 12)));
}

// 阶段文案按进度比例切换（与真实工具链顺序一致：解析→建池→路线→编排）
function stageByPct(pct: number): { key: TranslationKey; step: number } {
  if (pct < 30) return { key: 'progParsing', step: 1 };
  if (pct < 60) return { key: 'progPool', step: 2 };
  if (pct < 90) return { key: 'progMatrix', step: 3 };
  return { key: 'progPlanning', step: 4 };
}

function PlanningProgress({ active }: { active: boolean }) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  // hidden：不规划不占位；running：计时爬升；done：100% 完成态（900ms 后回 hidden）
  const [phase, setPhase] = useState<'running' | 'done' | 'hidden'>('hidden');
  const startedAt = useRef(0);

  // active 边沿驱动：新规划开始 → 重置计时；规划结束 → done + 定时淡出
  useEffect(() => {
    if (active) {
      startedAt.current = Date.now();
      setElapsed(0);
      setPhase('running');
    } else {
      setPhase((p) => (p === 'running' ? 'done' : p));
    }
  }, [active]);

  // done 900ms 后隐藏
  useEffect(() => {
    if (phase !== 'done') return;
    const timer = setTimeout(() => setPhase('hidden'), 900);
    return () => clearTimeout(timer);
  }, [phase]);

  // 计时器（仅 running 阶段跑）
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => {
      setElapsed((Date.now() - startedAt.current) / 1000);
    }, 500);
    return () => clearInterval(timer);
  }, [phase]);

  if (phase === 'hidden') return null;

  const pct = phase === 'done' ? 100 : fakeProgress(elapsed);
  const stage = phase === 'done' ? { key: 'progDone' as TranslationKey, step: 4 } : stageByPct(pct);

  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4 space-y-2.5 animate-fadeIn">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Loader2 className={`w-4 h-4 text-teal-600 ${phase === 'running' ? 'animate-spin' : ''}`} />
          <span className="text-xs font-semibold text-teal-800">{t('progressTitle')}</span>
        </div>
        <span className="text-[10px] text-teal-600/70 flex-shrink-0">
          {phase === 'done' ? '100%' : `${Math.floor(elapsed)}s`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-teal-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-teal-700 font-medium">{t(stage.key)}</span>
        <span className="text-[10px] text-teal-600/60">{stage.step} / 4 {t('progressStep')}</span>
      </div>
    </div>
  );
}

interface UserInputProps {
  onPlan: (request: Omit<UserRequest, 'id' | 'created_at'>) => void;
  isRunning: boolean;
}

export default function UserInput({ onPlan, isRunning }: UserInputProps) {
  const { t } = useI18n();
  const [destination, setDestination] = useState('北京');
  const [startDate, setStartDate] = useState('2026-04-10');
  const [departureTime, setDepartureTime] = useState('');
  const [endDate, setEndDate] = useState('2026-04-13');
  const [travelers, setTravelers] = useState('2');
  const [budget, setBudget] = useState('3000');
  const [maxDailyVisitHours, setMaxDailyVisitHours] = useState('6');
  const [maxDailyCommuteMinutes, setMaxDailyCommuteMinutes] = useState('60');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [prefInput, setPrefInput] = useState('');
  const [freeTextRequirement, setFreeTextRequirement] = useState('');

  const [departureLocation, setDepartureLocation] = useState('');
  const [returnLocation, setReturnLocation] = useState('');
  const [transportPreference, setTransportPreference] = useState<TransportPreference | ''>('');

  const addPreference = (pref?: string) => {
    const trimmed = (pref ?? prefInput).trim();
    if (trimmed && !preferences.includes(trimmed)) {
      setPreferences([...preferences, trimmed]);
      setPrefInput('');
    }
  };

  const removePreference = (pref: string) => {
    setPreferences(preferences.filter((p) => p !== pref));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPlan({
      destination,
      start_date: startDate,
      end_date: endDate,
      travelers: parseInt(travelers, 10) || 1,
      budget: parseInt(budget, 10) || 0,
      constraints: {
        max_daily_visit_hours: parseInt(maxDailyVisitHours, 10) || 6,
        max_daily_commute_minutes: parseInt(maxDailyCommuteMinutes, 10) || 60,
      },
      preferences,
      free_text_requirement: freeTextRequirement,
      departure_location: departureLocation.trim() || undefined,
      return_location: returnLocation.trim() || undefined,
      departure_time: departureTime || undefined,
      transport_preference: transportPreference || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{t('planYourTrip')}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('destination')}</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              placeholder={t('destinationPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('budget')}</label>
          <div className="relative">
            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              placeholder={t('budgetPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('departureLocation')}</label>
          <div className="relative">
            <PlaneTakeoff className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={departureLocation}
              onChange={(e) => setDepartureLocation(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              placeholder={t('departurePlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('returnLocation')}</label>
          <div className="relative">
            <PlaneLanding className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={returnLocation}
              onChange={(e) => setReturnLocation(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              placeholder={t('returnPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('transportPreference')}</label>
          <div className="relative">
            <Route className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={transportPreference}
              onChange={(e) => setTransportPreference(e.target.value as TransportPreference | '')}
              className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition appearance-none bg-white"
            >
              <option value="">{t('transportPrefNone')}</option>
              <option value="air">{t('transportPrefAir')}</option>
              <option value="rail">{t('transportPrefRail')}</option>
              <option value="speed">{t('transportPrefSpeed')}</option>
              <option value="cost">{t('transportPrefCost')}</option>
            </select>
          </div>
          <p className="text-xs text-slate-400">{t('transportPrefHint')}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('startDate')}</label>
          {/* 自建月历弹层替代 type="date"：安卓 WebView 会弹系统原生 Material 选择器，风格割裂 */}
          <DatePickerField value={startDate} onChange={setStartDate} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('departureTime')}</label>
          <TimePickerField value={departureTime} onChange={setDepartureTime} placeholder="--:--" />
          <p className="text-xs text-slate-400">{t('departureTimeHint')}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('endDate')}</label>
          <DatePickerField value={endDate} onChange={setEndDate} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('travelers')}</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="number"
              min="1"
              value={travelers}
              onChange={(e) => setTravelers(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              placeholder={t('travelersPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('addPreference')}</label>
          <div className="flex gap-2">
            <input
              value={prefInput}
              onChange={(e) => setPrefInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPreference();
                }
              }}
              className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              placeholder={t('prefPlaceholder')}
            />
            <button
              type="button"
              onClick={() => addPreference()}
              className="px-3 py-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {preferences.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {preferences.map((pref) => (
                <span
                  key={pref}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium"
                >
                  {pref}
                  <button type="button" onClick={() => removePreference(pref)} className="hover:text-teal-900 transition">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('constraintsTitle')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="relative">
              <input
                type="number"
                min="1"
                max="24"
                value={maxDailyVisitHours}
                onChange={(e) => setMaxDailyVisitHours(e.target.value)}
                className="w-full px-3 py-2.5 pr-14 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                placeholder={t('maxDailyVisitHours')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{t('unitHours')}</span>
            </div>
            <p className="text-xs text-slate-400">{t('visitHoursHint')}</p>
          </div>
          <div className="space-y-1">
            <div className="relative">
              <input
                type="number"
                min="0"
                max="480"
                value={maxDailyCommuteMinutes}
                onChange={(e) => setMaxDailyCommuteMinutes(e.target.value)}
                className="w-full px-3 py-2.5 pr-14 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                placeholder={t('maxDailyCommuteMinutes')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{t('unitMinutes')}</span>
            </div>
            <p className="text-xs text-slate-400">{t('commuteMinutesHint')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('additionalRequirements')}</label>
        <div className="relative">
          <MessageSquareText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <textarea
            value={freeTextRequirement}
            onChange={(e) => setFreeTextRequirement(e.target.value)}
            rows={3}
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-none"
            placeholder={t('freeTextPlaceholder')}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {isRunning ? t('planning') : t('planMyTrip')}
      </button>

      {/* 常驻挂载（内部自管显隐）：规划结束时才能播完 99→100% 的完成动画 */}
      <PlanningProgress active={isRunning} />
    </form>
  );
}
