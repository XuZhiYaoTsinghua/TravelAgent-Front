import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Compass, Brain, Globe, Bell, X, History, Trash2 } from 'lucide-react';
import UserInput from './components/UserInput';
import ItineraryTimeline from './components/ItineraryTimeline';
import MapView from './components/MapView';
import AgentLog from './components/AgentLog';
import ChatPanel from './components/ChatPanel';
import ActionQueue from './components/ActionQueue';
import NotificationBell from './components/NotificationBell';
// 重组件按需分包：推理页/通知中心只在对应视图首次进入时加载，
// 首屏主包显著瘦身（两者都依赖大量图表/列表渲染逻辑）
const AIReasoningPage = lazy(() => import('./components/AIReasoningPage'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
import { api } from './services/api';
import { notificationService } from './services/notifications';
import { loadSession, saveSession, clearSession } from './services/session';
import { localizePlan, localizeEvents, localizeActions, localizeActionResult } from './services/mockLocalize';
import { useI18n } from './i18n/I18nContext';
import { translations } from './i18n/translations';
import type { UserRequest, Plan, AgentEvent, AgentAction, AppView, TravelNotification, NotificationType, ToolCallRecord, HotelCandidate, RestaurantOption } from './types';

let idCounter = 0;
const nextId = () => `gen-${++idCounter}`;

// api 层抛错误码（无 i18n 上下文），此处按当前语言翻译；
// 未识别的错误原样透出（服务器自定义 error 文本等）
function localizeApiError(err: unknown, lang: 'en' | 'zh'): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (msg.startsWith('ERR_TIMEOUT|')) {
    const [, secs, path] = msg.split('|');
    return translations[lang].errTimeout(Number(secs), path ?? '');
  }
  if (msg === 'ERR_PLAN_INVALID') return translations[lang].msgPlanInvalid;
  return msg || translations[lang].msgRequestFailed;
}

// 懒加载视图的加载占位（避免白屏闪烁）
function ViewFallback() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-16 flex justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-teal-200 border-t-teal-600 animate-spin" />
    </main>
  );
}

function App() {
  const { lang, setLang, t } = useI18n();
  // 挂载时恢复上次现场（只读一次；loadSession 内含版本/结构/时效校验）
  const restored = useRef(loadSession());
  const [plan, setPlan] = useState<Plan | null>(restored.current.plan);
  const [events, setEvents] = useState<AgentEvent[]>(restored.current.events);
  const [actions, setActions] = useState<AgentAction[]>(restored.current.actions);
  // 标记当前行程是否来自 localStorage 恢复（用于显示提示条与清除入口）
  const [restoredFromCache, setRestoredFromCache] = useState(restored.current.plan !== null);
  const [isRunning, setIsRunning] = useState(false);
  const [view, setView] = useState<AppView>('dashboard');
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [hotels, setHotels] = useState<HotelCandidate[]>([]);
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
  const planAbort = useRef<AbortController | null>(null);
  // 轮询意愿：用户是否处于"应轮询"状态（页面隐藏时暂停，恢复时依据它续跑）
  const wantPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Android 物理返回键：子视图（推理页/通知中心）返回主页面而不是退出 App。
  // 无此监听时 Capacitor 默认行为是直接 finish Activity（用户误触即被踢出应用）。
  // 桌面浏览器无 backButton 事件，该监听自然不触发，无需平台判断。
  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (view !== 'dashboard') {
        setView('dashboard');
        return;
      }
      // 已在主页：维持 Android 惯例——有历史则退 WebView 历史，否则退出 App
      if (canGoBack) window.history.back();
      else CapacitorApp.exitApp();
    });
    return () => {
      void listener.then((h) => h.remove()).catch(() => undefined);
    };
  }, [view]);

  // 组件卸载时中止在飞的规划请求，防止向已卸载组件 setState
  useEffect(() => () => { planAbort.current?.abort(); }, []);

  const refreshLive = useCallback(async () => {
    try {
      await api.pollExecution();
      const newEvents = await api.fetchNewEvents(lang);
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
      // 决策面板已由对话面板取代：replans 只用于轮询检测时间线变化，不再上屏
      const [actions, replans] = await Promise.all([api.fetchActions(), api.fetchDecisions(lang)]);
      setActions(actions);
      if (replans.length > lastReplanCount.current) {
        lastReplanCount.current = replans.length;
        const refreshed = await api.fetchTimeline();
        if (refreshed) setPlan(refreshed);
        const [tc, hl] = await Promise.all([
          api.fetchToolCalls().catch(() => null),
          api.fetchHotels().catch(() => null),
        ]);
        if (tc) setToolCalls(tc);
        if (hl) setHotels(hl);
        // B 侧推送了重规划：触发通知三通道（列表+系统推送+banner）
        const affected = refreshed?.items[0]?.id;
        notificationService.simulateIncoming('plan_update', affected, lang);
        if (affected) setAffectedItemIds((prev) => [...new Set([...prev, affected])]);
      }
    } catch {
      // 轮询失败静默，下一轮重试
    }
  }, [lang]);

  const startPolling = useCallback(() => {
    stopPolling();
    wantPollingRef.current = true;
    pollTimer.current = setInterval(() => {
      refreshLive();
    }, 5000);
  }, [refreshLive, stopPolling]);

  // 页面不可见（切标签页/最小化）时暂停轮询：省电、省 B 服务器 QPS；
  // 回到前台立即补一次刷新并恢复轮询。卸载时清理监听。
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (wantPollingRef.current) {
          void refreshLive();
          startPolling();
        }
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refreshLive, startPolling, stopPolling]);

  const delay = (ms: number) =>
    new Promise<void>((r) => {
      const t = setTimeout(r, ms);
      timers.current.push(t);
    });

  // 手动清除恢复的会话：清 localStorage + 清全部 UI 状态（不影响下次正常规划）
  const handleResetSession = useCallback(() => {
    clearSession();
    planAbort.current?.abort();
    stopPolling();
    setPlan(null);
    setEvents([]);
    setActions([]);
    setToolCalls([]);
    setHotels([]);
    setRestoredFromCache(false);
  }, [stopPolling]);

  const runAgent = useCallback(async (request: Omit<UserRequest, 'id' | 'created_at'>) => {
    clearTimers();
    stopPolling();
    idCounter = 0;
    lastReplanCount.current = 0;
    // 竞态保护：中止上一轮仍在飞的规划请求，防止其返回后覆盖本次行程
    planAbort.current?.abort();
    planAbort.current = new AbortController();
    const mySignal = planAbort.current;
    // 缓存防护：发起新规划即作废旧现场（不等成功），失败/中断后刷新不会复活旧行程
    clearSession();
    setIsRunning(true);
    setPlan(null);
    setActions([]);
    setToolCalls([]);
    setHotels([]);
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
      // mock 数据动态导入：生产构建（USE_MOCK=false）下该分支为死代码，
      // rollup 会整块剔除，演示数据不会进主包（此前静态导入导致 14 处残留）
      const { mockEvents, mockActions } = await import('./mock');
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
      // 行程上屏即结束进度条，后续演示节奏事件不再拖住 isRunning（与真实路径一致）
      setIsRunning(false);

      setEvents((prev) => [
        ...prev,
        { id: nextId(), type: 'final', content: t('msgItineraryDelivered'), timestamp: new Date().toISOString() },
      ]);
      return;
    }

    // ===== 真实 API 流程（B 服务器 + A Planner） =====
    try {
      const generatedPlan = await api.submitPlan(request, mySignal.signal);
      // 请求期间被新规划取代：静默丢弃，不覆盖新行程
      if (mySignal.signal.aborted) return;
      setEvents((prev) => [
        ...prev,
        {
          id: nextId(),
          type: 'action',
          content: translations[lang].msgPlanGenerated(generatedPlan.destination, generatedPlan.items.length, generatedPlan.total_cost_estimate),
          timestamp: new Date().toISOString(),
        },
      ]);
      setPlan(generatedPlan);
      // ===== 行程交付即收尾（进度条修复）=====
      // 此前 isRunning 要等 tool-calls/hotels/refreshLive 数轮补充请求全部完成才置
      // false——行程内容已上屏，进度条却还在爬升，观感是"规划完成却不显示完成"。
      // 现在：交付瞬间发 final 事件 + 落盘 + 结束进度条（99→100），补充数据转后台。
      setEvents((prev) => {
        // 显式标注：中间变量会丢失上下文类型，type: 'final' 被拓宽成 string
        const next: AgentEvent[] = [
          ...prev,
          { id: nextId(), type: 'final', content: t('msgItineraryDelivered'), timestamp: new Date().toISOString() },
        ];
        // 行程交付时整体落盘（含用户尚未产生的自选餐厅标记，custom_meal 在 plan.items 内）
        saveSession({ plan: generatedPlan, events: next, decisions: [], actions: [] });
        return next;
      });
      // 新行程来自服务器实时生成，不是缓存恢复——清除恢复标记
      // （否则挂载时缓存有旧会话的话，首次规划完成后会误显示"已恢复"提示条）
      setRestoredFromCache(false);
      setIsRunning(false);
      // —— 以下为交付后的后台补充数据（推理页/通知中心用），不阻塞进度条 ——
      const [tc, hl] = await Promise.all([
        api.fetchToolCalls().catch(() => null),
        api.fetchHotels().catch(() => null),
      ]);
      if (mySignal.signal.aborted) return;
      if (tc) setToolCalls(tc);
      if (hl) setHotels(hl);
      await refreshLive();
      if (mySignal.signal.aborted) return;
      startPolling();
    } catch (err) {
      // 被新规划中止：不是错误，静默退出（isRunning 由新一轮管理）
      if (mySignal.signal.aborted) return;
      setEvents((prev) => [
        ...prev,
        {
          id: nextId(),
          type: 'error',
          content: localizeApiError(err, lang),
          timestamp: new Date().toISOString(),
        },
      ]);
    }
    if (mySignal.signal.aborted) return;
    // 错误路径兜底：成功路径已在行程交付时提前置 false（后台补充数据不等完）；
    // 重复置 false 无害，且被新规划中止时上面的 aborted 检查保证不会误关新一轮
    setIsRunning(false);
  }, [lang, t, refreshLive, startPolling, stopPolling]);

  // 餐段换餐厅：候选来自 B 侧 food 工具直调，选中后本地覆盖行程项
  // （名称/坐标/人均/简介同步更新，地图标记随坐标联动；A 侧不感知此改动）
  const handleSelectMeal = useCallback((itemId: string, option: RestaurantOption) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const [lngStr, latStr] = (option.location || '').split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      const nextPlan = {
        ...prev,
        items: prev.items.map((it) => {
          if (it.id !== itemId) return it;
          const mealType = it.activity.split(' · ')[0] || it.activity;
          const desc = [option.specialty, option.open_hours].filter(Boolean).join(' · ');
          return {
            ...it,
            place: {
              ...it.place,
              name: option.name,
              lat: Number.isFinite(lat) && lat !== 0 ? lat : it.place.lat,
              lng: Number.isFinite(lng) && lng !== 0 ? lng : it.place.lng,
              description: desc || undefined,
            },
            activity: [mealType, option.cuisine, `人均 ¥${Math.round(option.price_per_person)}`]
              .filter(Boolean)
              .join(' · '),
            cost_estimate: option.price_per_person > 0 ? Math.round(option.price_per_person) : it.cost_estimate,
            custom_meal: true,
          };
        }),
      };
      // 自选结果立即落盘：刷新后仍保留（旧现场被整体替换，无合并路径）
      saveSession({ plan: nextPlan, events: [], decisions: [], actions: [] });
      return nextPlan;
    });
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

  // 5s 轮询会触发重渲染：本地化计算全部 memo 化，避免每次轮询全量重跑
  // （轮询经常不带来新数据，重算纯属浪费）
  const localizedPlan = useMemo(() => (plan ? localizePlan(plan, lang) : null), [plan, lang]);
  const localizedEvents = useMemo(() => localizeEvents(events, lang), [events, lang]);
  const localizedActions = useMemo(() => localizeActions(actions, lang), [actions, lang]);
  // MapView 的 places 数组同样 memo：bounds 签名依赖其元素，稳定引用避免地图视野抖动
  const mapPlaces = useMemo(
    () => localizedPlan?.items.map((item) => item.place) ?? [],
    [localizedPlan],
  );

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
              {/* 行程来自上次会话的缓存恢复（localStorage），非服务器实时数据 */}
              {restoredFromCache && plan && !isRunning && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <History className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="text-xs text-amber-800 truncate">
                      {translations[lang].sessionRestored}
                    </span>
                  </div>
                  <button
                    onClick={handleResetSession}
                    className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {translations[lang].sessionClear}
                  </button>
                </div>
              )}
              <ItineraryTimeline plan={localizedPlan} affectedItemIds={affectedItemIds} onSelectMeal={handleSelectMeal} />
            </div>

            <div className="lg:col-span-4 space-y-6">
              <MapView places={mapPlaces} />
            </div>

            <div className="lg:col-span-3 space-y-6">
              <AgentLog events={localizedEvents} />
              <ActionQueue actions={localizedActions} onApprove={(id) => {
                api.approveAction(id).catch(() => {});
                setActions((prev) => prev.map((a) => a.id === id ? { ...a, status: 'running' } : a));
              }} />
            </div>
          </div>
        </main>
      )}

      {view === 'reasoning' && (
        <Suspense fallback={<ViewFallback />}>
          <AIReasoningPage
            events={localizedEvents}
            actions={localizedActions}
            toolCalls={toolCalls}
            hotels={hotels}
            isRunning={isRunning}
            onBack={() => setView('dashboard')}
          />
        </Suspense>
      )}

      {view === 'notifications' && (
        <Suspense fallback={<ViewFallback />}>
          <NotificationCenter
            notifications={notifications}
            onBack={() => setView('dashboard')}
            onMarkRead={(id) => notificationService.markRead(id)}
            onMarkAllRead={() => notificationService.markAllRead()}
            onClear={handleClearNotifications}
            onSimulate={handleSimulate}
          />
        </Suspense>
      )}

      {view !== 'reasoning' && (
        <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-xs text-slate-400">{t('footerText')}</p>
        </footer>
      )}

      {/* AI 对话浮窗（右下角）：不在主布局列中，fixed 定位悬浮于所有视图之上。
          key 绑定 plan.id：重新规划时组件重挂载，自动清空旧会话 history，
          防止上一轮行程的 Q&A 污染 LLM 上下文 */}
      <ChatPanel key={plan?.id ?? 'no-plan'} hasPlan={!!plan} />
    </div>
  );
}

export default App;
