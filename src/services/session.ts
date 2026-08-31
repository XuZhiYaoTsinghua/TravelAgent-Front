import type { Plan, AgentEvent, AgentDecision, AgentAction } from '../types';

// ===== 会话恢复存储（localStorage）=====
//
// 缓存污染防护（早期代码的教训：缓存顶替真实新数据）：
// 1. 只在 App 挂载时读取一次（lazy useState 初始化），运行期间绝不回读
//    → 新数据永远来自服务器，存储只用于"刷新后恢复现场"，不存在覆盖路径
// 2. runAgent 发起新规划的第一步就 clearSession()（而非等成功后覆盖）
//    → 规划失败/中断时，刷新页面不会复活已废弃的旧行程
// 3. 写入永远是整体覆盖（同一 key 原子替换），绝不与旧内容合并
// 4. 读取时三重校验：版本号 + 结构 + 时效，任一不符静默丢弃返回 null
// 5. isRunning 不持久化：刷新后永远不会出现"幽灵规划中"状态

const STORAGE_KEY = 'voyageai.session.v1';
const SCHEMA_VERSION = 3;
// 行程快照最长保留 24h：过期的现场没有恢复价值（行程日期可能已过）
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PersistedSession {
  version: number;
  savedAt: number;
  plan: Plan | null;
  events: AgentEvent[];
  decisions: AgentDecision[];
  actions: AgentAction[];
}

interface SessionLoadResult {
  plan: Plan | null;
  events: AgentEvent[];
  decisions: AgentDecision[];
  actions: AgentAction[];
}

// 严格校验 Plan 结构：destination/items 必在，item 需带 place 坐标结构
// 任何一次规划产物的字段缺失都拒绝恢复，宁可不恢复也不用脏数据
function isValidPlan(p: unknown): p is Plan {
  if (!p || typeof p !== 'object') return false;
  const plan = p as Partial<Plan>;
  if (typeof plan.destination !== 'string' || !plan.destination) return false;
  if (!Array.isArray(plan.items) || plan.items.length === 0) return false;
  return plan.items.every((it) => {
    if (!it || typeof it !== 'object') return false;
    const item = it as { place?: unknown; day?: unknown; id?: unknown };
    return Boolean(item.id) && typeof item.day === 'number' && item.place !== null && typeof item.place === 'object';
  });
}

function isSafeArray<T>(v: unknown): v is T[] {
  return Array.isArray(v);
}

/** 读取并校验会话：不可用/不存在/过期一律返回空现场（不抛错） */
export function loadSession(): SessionLoadResult {
  const empty: SessionLoadResult = { plan: null, events: [], decisions: [], actions: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    // 版本不符：旧格式直接丢弃（含清 key，防垃圾累积）
    if (parsed.version !== SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return empty;
    }
    // 时效检查
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return empty;
    }
    // 结构校验（plan 可为 null；其余必须安全数组）
    if (parsed.plan !== null && !isValidPlan(parsed.plan)) {
      localStorage.removeItem(STORAGE_KEY);
      return empty;
    }
    return {
      plan: parsed.plan ?? null,
      events: isSafeArray(parsed.events) ? parsed.events : [],
      decisions: isSafeArray(parsed.decisions) ? parsed.decisions : [],
      actions: isSafeArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    // JSON 损坏 / localStorage 不可用（隐私模式）：当无现场处理
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* 忽略 */ }
    return empty;
  }
}

/** 整体覆盖保存（原子替换，无合并路径）。失败静默——持久化是增强而非依赖 */
export function saveSession(session: Omit<PersistedSession, 'version' | 'savedAt'>): void {
  try {
    const payload: PersistedSession = {
      ...session,
      version: SCHEMA_VERSION,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 配额满/隐私模式：跳过持久化，不影响主流程
  }
}

/** 发起新规划时立即调用：旧现场即刻作废，失败规划不会复活旧数据 */
export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}
