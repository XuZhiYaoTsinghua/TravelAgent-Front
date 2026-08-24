import { CheckCircle2, Loader2, Circle, AlertCircle, ListChecks } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { translations } from '../i18n/translations';
import type { AgentAction, ActionStatus } from '../types';

function useStatusConfig() {
  const { lang } = useI18n();
  const tr = translations[lang];
  return {
    pending: { icon: Circle, color: 'text-slate-400', label: tr.statusPending },
    running: { icon: Loader2, color: 'text-sky-500', label: tr.statusRunning },
    completed: { icon: CheckCircle2, color: 'text-emerald-500', label: tr.statusDone },
    failed: { icon: AlertCircle, color: 'text-rose-500', label: tr.statusFailed },
  } as const;
}

interface ActionQueueProps {
  actions: AgentAction[];
}

export default function ActionQueue({ actions }: ActionQueueProps) {
  const { t } = useI18n();
  const statusConfig = useStatusConfig();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col max-h-[500px]">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <ListChecks className="w-4 h-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-slate-800">{t('actionQueue')}</h3>
        <span className="ml-auto text-xs text-slate-400">
          {actions.filter((a) => a.status === 'completed').length}/{actions.length} {t('done')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {actions.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">{t('noActions')}</p>
        )}
        {actions.map((action) => {
          const cfg = statusConfig[action.status];
          const Icon = cfg.icon;
          return (
            <div
              key={action.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                action.status === 'running'
                  ? 'border-sky-200 bg-sky-50'
                  : action.status === 'completed'
                  ? 'border-emerald-100 bg-emerald-50/50'
                  : action.status === 'failed'
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-slate-100 bg-slate-50/50'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.color} ${action.status === 'running' ? 'animate-spin' : ''}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{action.tool}</code>
                  <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-sm text-slate-700 mt-1">{action.description}</p>
                {action.result && (
                  <p className="text-xs text-slate-500 mt-1 pl-3 border-l-2 border-slate-200">{action.result}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
