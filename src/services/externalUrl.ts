import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

// 统一外链出口。
//
// 为什么不能直接用 <a target="_blank">：
// 1. Capacitor Android WebView 里 target=_blank 点击会被静默吞掉
//    （WebView 不知道怎么开新标签页，无插件接手时什么都不发生——
//    项目此前未装任何浏览器跳转插件，这是"点订票没反应"的根因）
// 2. 部分内嵌预览 WebView / 弹窗拦截器会拦截 window.open
//
// 兜底顺序：原生 → AppLauncher 交给系统浏览器；
//          Web → window.open 新标签；被拦截 → 当前页跳转（保证一定有反应）
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await AppLauncher.openUrl({ url });
      return;
    } catch {
      // 原生打开失败（极少数 ROM 无默认浏览器处理）：继续走 web 兜底
    }
  }
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    // window.open 被拦截（返回 null）：当前页直接跳转，绝不让点击无响应
    window.location.href = url;
  }
}
