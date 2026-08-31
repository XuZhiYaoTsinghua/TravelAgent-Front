import { GitBranch, Check, X, Clock } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { translations } from '../i18n/translations';
import type { AgentDecision, DecisionStatus } from '../types';

function useStatusConfig() {
  const { lang } = useI18n();
  const tr = translations[lang];
  return {
    pending: { color: 'text-amber-600', bg: 'bg-amber-50', label: tr.awaitingInput, icon: Clock },
    approved: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: tr.approved, icon: Check },
    rejected: { color: 'text-rose-600', bg: 'bg-rose-50', label: tr.rejected, icon: X },
  } as const;
}

interface DecisionPanelProps {
  decisions: AgentDecision[];
  onResolve: (decisionId: string, optionId: string) => void;
}

export default function DecisionPanel({ decisions, onResolve }: DecisionPanelProps) {
  const { t } = useI18n();
  const statusConfig = useStatusConfig();

  if (decisions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-800">{t('decisionPoints')}</h3>
        </div>
        <p className="text-slate-400 text-sm text-center py-4">{t('noDecisions')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {decisions.map((decision) => {
        const cfg = statusConfig[decision.status];
        const StatusIcon = cfg.icon;
        return (
          <div key={decision.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-semibold text-slate-800">{decision.title}</h3>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">{decision.description}</p>

            <div className="space-y-2">
              {decision.options.map((option) => (
                <button
                  key={option.id}
                  disabled={decision.status !== 'pending'}
                  onClick={() => onResolve(decision.id, option.id)}
                  className={`w-full text-left p-3 rounded-xl border transition group ${
                    option.selected
                      ? 'border-teal-300 bg-teal-50'
                      : decision.status === 'pending'
                      ? 'border-slate-200 hover:border-teal-200 hover:bg-teal-50/50'
                      : 'border-slate-100 bg-slate-50/50 opacity-70'
                  } disabled:cursor-not-allowed`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center transition ${
                      option.selected ? 'border-teal-500 bg-teal-500' : 'border-slate-300 group-hover:border-teal-400'
                    }`}>
                      {option.selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{option.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
