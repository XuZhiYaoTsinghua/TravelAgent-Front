import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Sparkles, Trash2, AlertCircle, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { api } from '../services/api';
import type { ChatMessage } from '../types';

interface DisplayMessage extends ChatMessage {
  id: string;
  error?: boolean;
}

let idCounter = 0;
const nextId = () => `chat-${++idCounter}`;

interface ChatPanelProps {
  hasPlan: boolean;
}

export default function ChatPanel({ hasPlan }: ChatPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = useCallback(
    async (text: string, displayBase?: DisplayMessage[]) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      const base = displayBase ?? messages;
      const nextDisplay: DisplayMessage[] = [...base, { id: nextId(), role: 'user', content: trimmed }];
      setMessages(nextDisplay);
      setInput('');
      setSending(true);
      const history: ChatMessage[] = base
        .filter((m) => !m.error)
        .map(({ role, content }) => ({ role, content }));
      try {
        const res = await api.chat(trimmed, history);
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: res.reply }]);
      } catch {
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: t('chatError'), error: true }]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, t],
  );

  const handleRetry = useCallback(() => {
    if (sending) return;
    let lastUserIdx = -1;
    messages.forEach((m, i) => {
      if (m.role === 'user') lastUserIdx = i;
    });
    if (lastUserIdx < 0) return;
    void send(messages[lastUserIdx].content, messages.slice(0, lastUserIdx));
  }, [messages, sending, send]);

  const suggestions = hasPlan
    ? [t('chatSuggestQ1'), t('chatSuggestQ2'), t('chatSuggestQ3')]
    : [];

  // 关闭态：右下角浮动圆形按钮
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[2000] w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        title={t('chatTitle')}
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  // 展开态：右下角浮窗
  return (
    <div className="fixed bottom-5 right-5 z-[2000] w-[calc(100vw-2.5rem)] sm:w-[380px] h-[70vh] sm:h-[520px] bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200 flex flex-col overflow-hidden animate-fadeIn">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-teal-50/60 to-cyan-50/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 leading-tight">{t('chatTitle')}</h3>
            <p className="text-[10px] text-slate-500 truncate">{t('chatSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg hover:bg-slate-100"
              title={t('clear')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg hover:bg-slate-100"
            title={t('chatClose')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-3 h-3 text-teal-600" />
            </div>
            <div className="bg-slate-100 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
              <p className="text-sm text-slate-600 leading-relaxed">{hasPlan ? t('chatWelcome') : t('chatPlanFirst')}</p>
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                <p className="text-sm leading-relaxed break-words">{m.content}</p>
              </div>
            </div>
          ) : m.error ? (
            <button
              key={m.id}
              onClick={handleRetry}
              className="flex items-start gap-2 text-left w-full group"
            >
              <div className="w-6 h-6 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-3 h-3 text-rose-500" />
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%] group-hover:bg-rose-100/70 transition">
                <p className="text-sm text-rose-600 leading-relaxed">{m.content}</p>
              </div>
            </button>
          ) : (
            <div key={m.id} className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-teal-600" />
              </div>
              <div className="bg-slate-100 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
              </div>
            </div>
          ),
        )}

        {sending && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-3 h-3 text-teal-600" />
            </div>
            <div className="bg-slate-100 rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
              <span className="text-xs text-slate-400 ml-1">{t('chatThinking')}...</span>
            </div>
          </div>
        )}
      </div>

      {messages.length === 0 && suggestions.length > 0 && (
        <div className="px-3.5 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              className="text-xs px-2.5 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50/60 hover:text-teal-700 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send(input);
            }}
            placeholder={t('chatPlaceholder')}
            disabled={sending}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition disabled:bg-slate-50"
          />
          <button
            onClick={() => void send(input)}
            disabled={sending || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title={t('chatSend')}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
