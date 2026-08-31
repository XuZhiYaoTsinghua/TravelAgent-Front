import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, MapPin, Calendar, Users, Coins, Sparkles, X, Plus, MessageSquareText, Loader2, Check, Wifi, Database } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { searchKeywords } from '../services/keywordSearch';
import type { UserRequest } from '../types';

interface UserInputProps {
  onPlan: (request: Omit<UserRequest, 'id' | 'created_at'>) => void;
  isRunning: boolean;
}

export default function UserInput({ onPlan, isRunning }: UserInputProps) {
  const { t, lang } = useI18n();
  const [destination, setDestination] = useState('Kyoto, Japan');
  const [startDate, setStartDate] = useState('2026-04-10');
  const [endDate, setEndDate] = useState('2026-04-13');
  const [travelers, setTravelers] = useState('2');
  const [budget, setBudget] = useState('3000');
  const [maxDailyVisitHours, setMaxDailyVisitHours] = useState('6');
  const [maxDailyCommuteMinutes, setMaxDailyCommuteMinutes] = useState('60');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [prefInput, setPrefInput] = useState('');
  const [freeTextRequirement, setFreeTextRequirement] = useState('');

  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchSource, setSearchSource] = useState<string>('');
  // 中文输入法拼音组合未上屏时不触发搜索，避免拼音被当成英文关键词搜出无关结果
  const composingRef = useRef(false);
  // 请求序号：慢的旧请求返回时发现自己已过期，丢弃结果，防止覆盖新输入的推荐词
  const searchSeqRef = useRef(0);

  const doSearch = useCallback(async (dest: string, l: typeof lang) => {
    const defaults = l === 'zh'
      ? ['文化', '风景', '美食', '历史', '自然', '摄影', '购物', '夜生活']
      : ['culture', 'scenery', 'food', 'history', 'nature', 'photography', 'shopping', 'nightlife'];
    if (!dest.trim()) {
      setSuggestedKeywords(defaults);
      setSearchSource('');
      return;
    }
    const seq = ++searchSeqRef.current;
    setSearching(true);
    setSuggestedKeywords(defaults);
    try {
      const result = await searchKeywords(dest, l);
      if (seq !== searchSeqRef.current) return; // 已有更新的输入，丢弃本次结果
      setSuggestedKeywords(result.keywords);
      setSearchSource(result.source);
    } catch {
      if (seq !== searchSeqRef.current) return;
      setSearchSource('fallback');
    } finally {
      if (seq === searchSeqRef.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (composingRef.current) return;
    const timer = setTimeout(() => doSearch(destination, lang), 600);
    return () => clearTimeout(timer);
  }, [destination, lang, doSearch]);

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
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={(e) => {
                composingRef.current = false;
                setDestination((e.target as HTMLInputElement).value);
              }}
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
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('startDate')}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('endDate')}</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
          </div>
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

      {/* Keyword search results - always visible */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('keywordSearchTitle')}</label>
          {searching ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('searching')}
            </span>
          ) : searchSource === 'local' ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <Database className="w-3 h-3" />
              {t('searchSourceLocal')}
            </span>
          ) : searchSource === 'wiki' || searchSource === 'osm' ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <Wifi className="w-3 h-3" />
              {t('searchSource')}
            </span>
          ) : searchSource === 'fallback' ? (
            <span className="text-[10px] text-amber-500 font-medium">{t('searchUnavailable')}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestedKeywords.map((kw) => {
            const added = preferences.includes(kw);
            return (
              <button
                key={kw}
                type="button"
                onClick={() => !added && addPreference(kw)}
                disabled={added}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    added
                      ? 'bg-teal-100 text-teal-400 cursor-default'
                      : 'bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-700 border border-slate-200'
                  }`}
                >
                  {added && <Check className="w-3 h-3" />}
                  {kw}
                </button>
              );
            })}
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
    </form>
  );
}
