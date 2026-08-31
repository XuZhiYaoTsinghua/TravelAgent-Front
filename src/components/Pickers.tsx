import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

// 自建日期/时间选择器。
// 背景：<input type="date"/"time"> 在 Android WebView 里会弹出系统原生
// Material 选择器，风格与 App 的 teal/slate 设计语言完全脱节（问题2）。
// 这里改为应用内弹层：月历选日期、小时+分钟网格选时间，
// 视觉沿用全局表单样式（rounded-lg / border-slate-200 / teal 焦点色）。

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 点击弹层外任意处关闭（mousedown 比 click 早，避免误触按钮自身）
function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);
  return ref;
}

// ===== 日期选择（月历弹层） =====
export function DatePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const locale = lang === 'zh' ? 'zh-CN' : 'en-US';

  // 弹层当前展示的年月（打开时定位到已选日期所在月，无值则当月）
  const [view, setView] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  const wrapRef = useOutsideClose(() => setOpen(false));

  const weekdayLabels = useMemo(() => {
    // 2023-01-01 恰为周日：从它推一周标签，交给 Intl 本地化
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }, [locale]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(view.y, view.m, 1)),
    [locale, view]
  );

  // 6 行 × 7 列日历格：含前后月补位（置灰不可点会损失「跳到下月」的便捷，故可点并切换）
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const offset = first.getDay(); // 周日 = 0
    const start = new Date(view.y, view.m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { date: d, iso: isoOf(d), inMonth: d.getMonth() === view.m };
    });
  }, [view]);

  const todayIso = isoOf(new Date());

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-slate-200 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition flex items-center justify-between gap-2"
      >
        <span className={value ? 'text-slate-700' : 'text-slate-400'}>{value || '—'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 w-[286px] max-w-full bg-white rounded-xl border border-slate-200 shadow-xl p-3 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-700">{monthLabel}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {weekdayLabels.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-slate-400 py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 justify-items-center">
            {cells.map(({ date, iso, inMonth }) => {
              const selected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  className={`h-9 w-9 rounded-lg text-xs transition flex items-center justify-center
                    ${inMonth ? 'text-slate-600' : 'text-slate-300'}
                    ${isToday && !selected ? 'ring-1 ring-teal-300 text-teal-600' : ''}
                    ${selected ? 'bg-teal-500 text-white font-semibold shadow-sm' : 'hover:bg-teal-50'}
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 时间选择（小时 + 分钟网格弹层，5 分钟步进） =====
export function TimePickerField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // 草稿小时：点小时只高亮，点分钟才成对写入并关闭（避免只选一半的中间态落库）
  const [draftHour, setDraftHour] = useState<number | null>(null);
  const wrapRef = useOutsideClose(() => setOpen(false));

  const currentHour = value ? Number(value.split(':')[0]) : null;
  const currentMinute = value ? Number(value.split(':')[1]) : null;
  const activeHour = draftHour ?? currentHour;

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  // 5 分钟步进（00/05/…/55）：出发时间无需分钟级精度，网格更紧凑
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  const pickMinute = (mm: number) => {
    const hh = activeHour ?? 9; // 未选小时直接点分钟：按 9 点（A 侧缺省出发时刻）
    onChange(`${pad(hh)}:${pad(mm)}`);
    setOpen(false);
    setDraftHour(null);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
      <button
        type="button"
        onClick={() => {
          // 每次打开重置草稿小时：上次未完成的草稿选择不应残留到新一次打开
          if (!open) setDraftHour(null);
          setOpen((v) => !v);
        }}
        className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-slate-200 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition flex items-center justify-between gap-2"
      >
        <span className={value ? 'text-slate-700' : 'text-slate-400'}>{value || placeholder || '--:--'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-xl border border-slate-200 shadow-xl p-3 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{t('pickerHour')}</span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setDraftHour(null);
                }}
                className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-rose-500 px-1.5 py-0.5 rounded-md hover:bg-rose-50 transition"
              >
                <X className="w-3 h-3" />
                {t('pickerClear')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1 mb-3">
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setDraftHour(h)}
                className={`h-8 rounded-lg text-xs transition
                  ${activeHour === h ? 'bg-teal-500 text-white font-semibold shadow-sm' : 'text-slate-600 hover:bg-teal-50'}
                `}
              >
                {pad(h)}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('pickerMinute')}</div>
          <div className="grid grid-cols-6 gap-1">
            {minutes.map((mm) => (
              <button
                key={mm}
                type="button"
                onClick={() => pickMinute(mm)}
                className={`h-8 rounded-lg text-xs transition
                  ${currentMinute === mm && activeHour === currentHour ? 'bg-teal-100 text-teal-700 font-semibold' : 'text-slate-600 hover:bg-teal-50'}
                `}
              >
                {pad(mm)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
