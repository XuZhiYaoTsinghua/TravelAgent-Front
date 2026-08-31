import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { openExternalUrl } from '../services/externalUrl';

interface BookingWebViewProps {
  url: string;
  title?: string;
  onClose: () => void;
}

// 应用内全屏 WebView：左上角强制返回按钮，主体 iframe 加载高德。
//
// 为什么不直接 openExternalUrl：
// 1. Capacitor WebView 里 AppLauncher 偶发失败 → fallback 到 window.location.href
//    导致整个 WebView 被高德页面覆盖，用户"困"在高德无法回到 App
// 2. 用 iframe 在应用内打开，返回按钮始终可见，用户随时回到 App 主页
//
// iframe 加载失败（高德设了 X-Frame-Options）时：
// 展示"在新窗口打开"按钮 fallback 到 openExternalUrl
export default function BookingWebView({ url, title, onClose }: BookingWebViewProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // iframe load 事件不一定可靠触发（跨域），用 8s 超时兜底判断是否被拦截
  useEffect(() => {
    timerRef.current = setTimeout(() => setBlocked(true), 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleLoad = useCallback(() => {
    setLoading(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleFallback = useCallback(() => {
    void openExternalUrl(url);
    onClose();
  }, [url, onClose]);

  // 硬件/物理返回键也关闭 overlay（Capacitor Android 返回键走 popstate）
  useEffect(() => {
    const onPopState = () => onClose();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fadeIn">
      {/* 顶栏：左上角强制返回按钮 */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition font-medium text-sm flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToApp')}
        </button>
        <span className="text-xs text-slate-400 truncate flex-1">{title ?? url}</span>
        {loading && !blocked && (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
        )}
      </div>

      {/* iframe 主体 */}
      <div className="flex-1 relative">
        {blocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <p className="text-sm text-slate-500 text-center max-w-xs">
              {t('bookingBlockedHint')}
            </p>
            <button
              onClick={handleFallback}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {t('bookingOpenExternal')}
            </button>
          </div>
        ) : (
          <iframe
            src={url}
            onLoad={handleLoad}
            className="w-full h-full border-0"
            title={title ?? 'booking'}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        )}
      </div>
    </div>
  );
}
