import { useEffect, useRef } from 'react';
import { Brain, Wrench, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { translations } from '../i18n/translations';
import type { AgentEvent, EventType } from '../types';

function useTypeConfig() {
  const { lang } = useI18n();
  const tr = translations[lang];
  return {
    thinking: { icon: Brain, color: 'text-violet-400', bg: 'bg-violet-500/15', label: tr.evtThinking },
    action: { icon: Wrench, color: 'text-sky-400', bg: 'bg-sky-500/15', label: tr.evtAction },
    observation: { icon: Eye, color: 'text-amber-400', bg: 'bg-amber-500/15', label: tr.evtObservation },
    final: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: tr.evtFinal },
    error: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/15', label: tr.evtError },
  } as const;
}

interface AgentLogProps {
  events: AgentEvent[];
}

export default function AgentLog({ events }: AgentLogProps) {
  const { t } = useI18n();
  const typeConfig = useTypeConfig();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 flex flex-col max-h-[500px]">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <h3 className="text-sm font-semibold text-slate-200">{t('agentLog')}</h3>
        <span className="ml-auto text-xs text-slate-500">{events.length} {t('events')}</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {events.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">{t('noLogs')}</p>
        )}
        {events.map((event) => {
          const cfg = typeConfig[event.type];
          const Icon = cfg.icon;
          return (
            <div key={event.id} className="flex gap-3 items-start animate-fadeIn">
              <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center ${cfg.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-0.5 leading-relaxed">{event.content}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
