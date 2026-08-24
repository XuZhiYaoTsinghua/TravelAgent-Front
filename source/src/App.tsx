import { useState, useCallback, useRef, useEffect } from 'react';
import { Compass, Brain, Globe, Bell, X } from 'lucide-react';
import UserInput from './components/UserInput';
import ItineraryTimeline from './components/ItineraryTimeline';
import MapView from './components/MapView';
import AgentLog from './components/AgentLog';
import DecisionPanel from './components/DecisionPanel';
import ActionQueue from './components/ActionQueue';
import NotificationBell from './components/NotificationBell';
import NotificationCenter from './components/NotificationCenter';
import AIReasoningPage from './components/AIReasoningPage';
import { api } from './services/api';
import { notificationService } from './services/notifications';
import { mockEvents, mockActions, mockActionResults, mockDecisions } from './mock';
import { localizePlan, localizeEvents, localizeDecisions, localizeActions, localizeActionResult } from './services/mockLocalize';
import { useI18n } from './i18n/I18nContext';
import { translations } from './i18n/translations';
import type { UserRequest, Plan, AgentEvent, AgentDecision, AgentAction, AppView, TravelNotification, NotificationType } from './types';

let idCounter = 0;
const nextId = () => `gen-${++idCounter}`;

function App() {
  const { lang, setLang, t } = useI18n();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [view, setView] = useState<AppView>('dashboard');
  const [notifications, setNotifications] = useState<TravelNotification[]>([]);
  const [affectedItemIds, setAffectedItemIds] = useState<string[]>([]);
  const [banner, setBanner] = useState<TravelNotification | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = notificationService.subscribe(setNotifications);
    notificationService.initNativePush().catch(() => {});
    const unsubBanner = notificationService.onBanner((n) => {
      setBanner(n);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(() => setBanner(null), 5000);
    });
    return () => { unsub(); unsubBanner(); };
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastReplanCount = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const refreshLive = useCallback(async () => {
    try {
      await api.pollExecution();
      const newEvents = await api.fetchNewEvents();
      if (newEvents.length) {
        setEvents((prev) => {
          const knownIds = new Set(prev.map((e) => e.id));
          const seenContent = new Set(prev.map((e) => `${e.type}|${e.content}`));
          const fresh = newEvents.filter(
            (e) => !knownIds.has(e.id) && !seenContent.has(`${e.type}|${e.content}`)
          );
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      }
      const [actions, decisions] = await Promise.all([api.fetchActions(), api.fetchDecisions()]);
      setActions(actions);
      setDecisions(decisions);
      if (decisions.length > lastReplanCount.current) {
        lastReplanCount.current = decisions.length;
        const refreshed = await api.fetchTimeline();
        if (refreshed) setPlan(refreshed);
      }
    } catch {
      // 轮询失败静默，下一轮重试
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimer.current = setInterval(() => {
      refreshLive();
    }, 5000);
  }, [refreshLive, stopPolling]);

  const delay = (ms: number) =>
    new Promise<void>((r) => {
      const t = setTimeout(r, ms);
      timers.current.push(t);
    });

  const runAgent = useCallback(async (request: Omit<UserRequest, 'id' | 'created_at'>) => {
    clearTimers();
    stopPolling();
    idCounter = 0;
    lastReplanCount.current = 0;
    setIsRunning(true);
    setPlan(null);
    setDecisions([]);
    setActions([]);
    setAffectedItemIds([]);
    setEvents([
      {
        id: nextId(),
        type: 'thinking',
        content: translations[lang].msgReceivedRequest(request.destination, request.travelers, request.start_date, request.end_date),
        timestamp: new Date().toISOString(),
      },
    ]);

    if (api.isMock) {
      const submittedRequest = await api.submitRequest(request);

      for (const evt of mockEvents) {
        await delay(900);
        setEvents((prev) => [
          ...prev,
          { ...evt, id: nextId(), timestamp: new Date().toISOString() },
        ]);
      }

      const initialActions = mockActions.map((a) => ({ ...a, id: nextId(), originalId: a.id }));
      setActions(initialActions.map(({ originalId: _o, ...rest }) => rest));

      for (const action of initialActions) {
        if (action.status === 'completed') continue;

        await delay(700);
        setActions((prev) =>
          prev.map((a) => (a.id === action.id ? { ...a, status: 'running', started_at: new Date().toISOString() } : a))
        );

        await delay(1200);
        const result = localizeActionResult(action.originalId, api.getMockActionResult(action.originalId) ?? 'Done', lang);
        setActions((prev) =>
          prev.map((a) =>
            a.id === action.id
              ? { ...a, status: 'completed', result, completed_at: new Date().toISOString() }
              : a
          )
        );
      }

      await delay(600);
      const fetchedPlan = await api.getPlan(submittedRequest.id);
      setPlan(fetchedPlan);

      await delay(400);
      setDecisions(mockDecisions.map((d) => ({ ...d, id: nextId() })));

      setEvents((prev) => [
        ...prev,
        { id: nextId(), type: 'final', content: t('msgItineraryDelivered'), timestamp: new Date().toISOString() },
      ]);
      setIsRunning(false);
      return;
    }

    // ===== 真实 API 流程（B 服务器 + A Planner） =====
    try {
      const generatedPlan = await api.submitPlan(request);
      setEvents((prev) => [
        ...prev,
        {
          id: nextId(),
          type: 'action',
          content: `已连接决策引擎，生成 ${generatedPlan.destination} 行程：${generatedPlan.items.length} 个安排，预估费用 ¥${generatedPlan.total_cost_estimate}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      setPlan(generatedPlan);
      await refreshLive();
      startPolling();
      setEvents((prev) => [
        ...prev,
        { id: nextId(), type: 'final', content: t('msgItineraryDelivered'), timestamp: new Date().toISOString() },
      ]);
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        {
          id: nextId(),
          type: 'error',
          content: err instanceof Error ? err.message : '请求失败，请检查网络连接',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    setIsRunning(false);
  }, [lang, t, refreshLive, startPolling, stopPolling]);

  const handleResolveDecision = useCallback((decisionId: string, optionId: string) => {
    setDecisions((prev) =>
      prev.map((d) =>
        d.id === decisionId
          ? {
              ...d,
              status: 'approved',
              options: d.options.map((o) => ({ ...o, selected: o.id === optionId })),
            }
          : d
      )
    );
  }, []);

  const handleSimulate = useCallback(() => {
    const items = plan?.items ?? [];
    const affected = items.length > 0 ? items[Math.floor(Math.random() * items.length)].id : undefined;
    const types: NotificationType[] = ['delay', 'weather', 'plan_update'];
    const tp = types[Math.floor(Math.random() * types.length)];
    notificationService.simulateIncoming(tp, affected, lang);
    if (affected) setAffectedItemIds((prev) => [...new Set([...prev, affected])]);
  }, [plan, lang]);

  const handleClearNotifications = useCallback(() => {
    notificationService.clear();
    setAffectedItemIds([]);
  }, []);

  const navItems: { key: AppView; label: string; icon: typeof Compass }[] = [
    { key: 'dashboard', label: t('navTrip'), icon: Compass },
    { key: 'reasoning', label: t('navReasoning'), icon: Brain },
  ];

  const localizedPlan = plan ? localizePlan(plan, lang) : null;
  const localizedEvents = localizeEvents(events, lang);
  const localizedDecisions = localizeDecisions(decisions, lang);
  const localizedActions = localizeActions(actions, lang);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-sm">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-slate-800 leading-tight">{t('appName')}</h1>
              <p className="text-[10px] text-slate-500">{t('appTagline')}</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition text-xs font-medium"
              title={lang === 'zh' ? 'Switch to English' : '切换为中文'}
            >
              <Globe className="w-4 h-4" />
              {lang === 'zh' ? '中' : 'EN'}
            </button>
            <div className="hidden sm:flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-xs text-slate-500">{isRunning ? t('statusWorking') : t('statusReady')}</span>
            </div>
            <NotificationBell
              notifications={notifications}
              active={view === 'notifications'}
              onClick={() => setView(view === 'notifications' ? 'dashboard' : 'notifications')}
            />
          </div>
        </div>
      </header>

      {banner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md" style={{ animation: 'bannerSlideIn 0.3s ease-out' }}>
          <div className={`rounded-xl shadow-lg border p-4 flex items-start gap-3 animate-slide-down ${
            banner.priority === 'high' ? 'bg-red-50 border-red-200' :
            banner.priority === 'medium' ? 'bg-amber-50 border-amber-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              banner.priority === 'high' ? 'bg-red-100' :
              banner.priority === 'medium' ? 'bg-amber-100' :
              'bg-blue-100'
            }`}>
              <Bell className={`w-4 h-4 ${
                banner.priority === 'high' ? 'text-red-600' :
                banner.priority === 'medium' ? 'text-amber-600' :
                'text-blue-600'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{banner.title}</p>
              <p className="text-xs text-slate-600 mt-0.5">{banner.message}</p>
            </div>
            <button
              onClick={() => setBanner(null)}
              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-6">
              <UserInput onPlan={runAgent} isRunning={isRunning} />
              <ItineraryTimeline plan={localizedPlan} affectedItemIds={affectedItemIds} />
            </div>

            <div className="lg:col-span-4 space-y-6">
              <MapView places={localizedPlan?.items.map((item) => item.place) ?? []} />
              <DecisionPanel decisions={localizedDecisions} onResolve={handleResolveDecision} />
            </div>

            <div className="lg:col-span-3 space-y-6">
              <AgentLog events={localizedEvents} />
              <ActionQueue actions={localizedActions} />
            </div>
          </div>
        </main>
      )}

      {view === 'reasoning' && (
        <AIReasoningPage
          events={localizedEvents}
          actions={localizedActions}
          isRunning={isRunning}
          onBack={() => setView('dashboard')}
        />
      )}

      {view === 'notifications' && (
        <NotificationCenter
          notifications={notifications}
          onBack={() => setView('dashboard')}
          onMarkRead={(id) => notificationService.markRead(id)}
          onMarkAllRead={() => notificationService.markAllRead()}
          onClear={handleClearNotifications}
          onSimulate={handleSimulate}
        />
      )}

      {view !== 'reasoning' && (
        <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-slate-400">{t('footerText')}</p>
        </footer>
      )}
    </div>
  );
}

export default App;
