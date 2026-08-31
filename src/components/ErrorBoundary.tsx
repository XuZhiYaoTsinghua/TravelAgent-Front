import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// 全局兜底：任一子树渲染抛错时展示恢复界面而非白屏。
// 生产包无 React 错误overlay，此前崩溃即整页空白、无法自救。
// 恢复动作仅清 UI 状态，不动 localStorage 会话（行程现场保留）。
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 控制台留痕便于排查（不上报远端，无遥测依赖）
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    // 语言读 I18nContext 持久化的偏好（travel_agent_lang），而非 documentElement.lang——
    // 后者是 index.html 里的静态 "en"，运行时切语言不更新，此前中文用户崩溃时看到英文
    let lang = 'zh';
    try {
      lang = localStorage.getItem('travel_agent_lang') === 'en' ? 'en' : 'zh';
    } catch { /* localStorage 不可用时默认中文 */ }
    const isEn = lang === 'en';
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold text-slate-800">
            {isEn ? 'Something went wrong' : '页面出了点问题'}
          </h1>
          <p className="text-sm text-slate-500">
            {isEn
              ? 'A rendering error occurred. Your trip data is preserved — try recovering below.'
              : '界面渲染出错。你的行程数据已保留，可尝试下方恢复。'}
          </p>
          <pre className="text-left text-[11px] text-slate-400 bg-white/60 rounded-lg p-3 overflow-auto max-h-32">
            {this.state.error.message}
          </pre>
          <div className="flex justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition"
            >
              {isEn ? 'Retry render' : '重试渲染'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition"
            >
              {isEn ? 'Reload app' : '刷新页面'}
            </button>
          </div>
        </div>
      </main>
    );
  }
}
