import { useState } from 'react';
import {
  Brain,
  Wrench,
  Eye,
  GitBranch,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Circle,
  Clock,
  Activity,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { translations } from '../i18n/translations';
import type { AgentEvent, AgentAction, EventType, ActionStatus } from '../types';

function useEventConfig() {
  const { lang } = useI18n();
  const tr = translations[lang];
  return {
    thinking: { icon: Brain, color: 'text-violet-300', bg: 'bg-violet-500/15', label: tr.evtThinking },
    action: { icon: Wrench, color: 'text-sky-300', bg: 'bg-sky-500/15', label: tr.evtAction },
    observation: { icon: Eye, color: 'text-amber-300', bg: 'bg-amber-500/15', label: tr.evtObservation },
    final: { icon: CheckCircle2, color: 'text-emerald-300', bg: 'bg-emerald-500/15', label: tr.evtFinal },
    error: { icon: AlertCircle, color: 'text-rose-300', bg: 'bg-rose-500/15', label: tr.evtError },
  } as const;
}

function useActionStatusConfig() {
  const { lang } = useI18n();
  const tr = translations[lang];
  return {
    pending: { icon: Circle, color: 'text-slate-400', label: tr.statusPending },
    running: { icon: Loader2, color: 'text-sky-400', label: tr.statusRunning },
    completed: { icon: CheckCircle2, color: 'text-emerald-400', label: tr.statusDone },
    failed: { icon: AlertCircle, color: 'text-rose-400', label: tr.statusFailed },
  } as const;
}

interface AIReasoningPageProps {
  events: AgentEvent[];
  actions: AgentAction[];
  isRunning: boolean;
  onBack: () => void;
}

function EventRow({ event }: { event: AgentEvent }) {
  const { t, lang } = useI18n();
  const eventConfig = useEventConfig();
  const [open, setOpen] = useState(false);
  const cfg = eventConfig[event.type];
  const Icon = cfg.icon;
  const hasMeta = event.metadata && Object.keys(event.metadata).length > 0;

  return (
    <div className="flex gap-3 items-start">
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center ${cfg.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-slate-500">
            {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
          </span>
          {hasMeta && (
            <button onClick={() => setOpen((o) => !o)} className="text-slate-500 hover:text-slate-300 transition">
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">{event.content}</p>
        {open && hasMeta && (
          <pre className="mt-1.5 text-xs text-slate-400 bg-slate-950/60 border border-slate-700/50 rounded-lg p-2.5 overflow-x-auto">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function ToolCard({ action }: { action: AgentAction }) {
  const { t } = useI18n();
  const actionStatusConfig = useActionStatusConfig();
  const [open, setOpen] = useState(false);
  const cfg = actionStatusConfig[action.status];
  const Icon = cfg.icon;
  const hasDetail = action.input || action.result;

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        action.status === 'running'
          ? 'border-sky-400/30 bg-sky-500/5'
          : action.status === 'completed'
          ? 'border-emerald-400/20 bg-emerald-500/5'
          : 'border-slate-700/50 bg-slate-800/30'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${cfg.color} ${action.status === 'running' ? 'animate-spin' : ''}`} />
        <code className="text-xs font-mono text-slate-300 bg-slate-700/40 px-1.5 py-0.5 rounded">{action.tool}</code>
        <span className={`text-xs font-medium ${cfg.color} ml-auto`}>{cfg.label}</span>
      </div>
      <p className="text-sm text-slate-400 mt-1.5">{action.description}</p>
      {hasDetail && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-slate-500 hover:text-slate-300 mt-2 inline-flex items-center gap-1"
          >
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {open ? t('hideDetails') : t('showDetails')}
          </button>
          {open && (
            <div className="mt-2 space-y-1.5">
              {action.input && (
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{t('input')}</span>
                  <pre className="text-xs text-sky-300 bg-slate-950/60 border border-slate-700/50 rounded-lg p-2 overflow-x-auto mt-0.5">
                    {JSON.stringify(action.input, null, 2)}
                  </pre>
                </div>
              )}
              {action.result && (
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{t('output')}</span>
                  <p className="text-xs text-emerald-300 bg-slate-950/60 border border-slate-700/50 rounded-lg p-2 mt-0.5">
                    {action.result}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AIReasoningPage({ events, actions, isRunning, onBack }: AIReasoningPageProps) {
  const { t, lang } = useI18n();
  const tr = translations[lang];
  const eventConfig = useEventConfig();
  const actionStatusConfig = useActionStatusConfig();

  const thinkingCount = events.filter((e) => e.type === 'thinking').length;
  const actionCount = events.filter((e) => e.type === 'action').length;
  const obsCount = events.filter((e) => e.type === 'observation').length;
  const counts: Record<string, number> = { thinking: thinkingCount, action: actionCount, observation: obsCount, final: events.filter((e) => e.type === 'final').length };
  const doneActions = actions.filter((a) => a.status === 'completed').length;

  const LOOP_STEPS = [
    { key: 'thinking' as EventType, label: tr.evtThinking, icon: Brain, ring: 'border-violet-400/40', dot: 'bg-violet-400' },
    { key: 'action' as EventType, label: tr.evtAction, icon: Wrench, ring: 'border-sky-400/40', dot: 'bg-sky-400' },
    { key: 'observation' as EventType, label: tr.evtObservation, icon: Eye, ring: 'border-amber-400/40', dot: 'bg-amber-400' },
    { key: 'final' as EventType, label: tr.navReasoning, icon: GitBranch, ring: 'border-teal-400/40', dot: 'bg-teal-400' },
  ];

  return (
    <div className="bg-slate-950 min-h-[calc(100vh-65px)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-violet-400" />
              {t('agentReasoning')}
            </h2>
            <p className="text-xs text-slate-500">
              {isRunning ? t('agentWorking') : t('agentIdle')}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              {t('autonomousLoop')}
            </h3>
            <span className={`text-xs ${isRunning ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isRunning ? `● ${t('running')}` : `● ${t('idle')}`}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            {LOOP_STEPS.map((step, i) => {
              const Icon = step.icon;
              const active = isRunning && i === 0;
              return (
                <div key={step.key} className="flex items-center gap-2 flex-shrink-0">
                  <div className={`flex flex-col items-center gap-1.5 ${active ? 'animate-pulse' : ''}`}>
                    <div className={`w-12 h-12 rounded-full border-2 ${step.ring} bg-slate-800/80 flex items-center justify-center ${active ? 'scale-110' : ''} transition`}>
                      <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <span className="text-xs text-slate-400">{step.label}</span>
                    <span className="text-[10px] text-slate-600">{counts[step.key] ?? 0}x</span>
                  </div>
                  {i < LOOP_STEPS.length - 1 && (
                    <div className="flex-shrink-0 w-6 sm:w-10 h-px bg-gradient-to-r from-slate-700 to-slate-600 relative">
                      <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]">→</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">{t('reasoningStream')}</h3>
              <span className="text-xs text-slate-500">{events.length} {t('events')}</span>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {events.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-8">{t('noReasoningEvents')}</p>
              ) : (
                events.map((event) => <EventRow key={event.id} event={event} />)
              )}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">{t('toolCalls')}</h3>
              <span className="text-xs text-slate-500">
                {doneActions}/{actions.length} {t('done')}
              </span>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {actions.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-8">{t('noToolCalls')}</p>
              ) : (
                actions.map((action) => <ToolCard key={action.id} action={action} />)
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-5 flex items-center justify-center gap-1.5">
          <Clock className="w-3 h-3" />
          {t('reasoningFooter')}
        </p>
      </div>
    </div>
  );
}
