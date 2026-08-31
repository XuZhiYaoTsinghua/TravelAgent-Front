import type {
  UserRequest,
  Plan,
  AgentEvent,
  AgentDecision,
  AgentAction,
  BMonitorEvent,
  BActionItem,
  BReplanEntry,
  BTripTimeline,
  ToolCallRecord,
  HotelCandidate,
  RestaurantOption,
} from '../types';
import {
  userRequestToPlanBody,
  timelineToPlan,
  monitorEventToAgentEvent,
  bActionToAgentAction,
  replanToDecision,
} from './adapter';
import {
  mockUserRequest,
  mockPlan,
  mockEvents,
  mockDecisions,
  mockActions,
  mockActionResults,
} from '../mock';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Mock 默认关闭：未显式配置 VITE_USE_MOCK='true' 时一律走真实接口。
// 旧逻辑 `!== 'false'` 会在打包忘配环境变量时静默上线假数据（mock 流程无报错、极难排查）
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

let eventCursor = 0;
let lastTravelers = 1;

// 规划是长请求（实测 20~70s），其余接口 15s 足够
const TIMEOUT_PLAN_MS = 90_000;
const TIMEOUT_DEFAULT_MS = 15_000;

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException || (e instanceof Error && e.name === 'AbortError');
}

async function fetchJSON<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = TIMEOUT_DEFAULT_MS, ...init } = options ?? {};
  const controller = new AbortController();
  // 外部 signal（用于规划竞态中止）与内部超时合并：任一触发即中止
  const externalSignal = init.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((data as { error?: string } | null)?.error || `API error ${res.status}`);
    }
    return data as T;
  } catch (e) {
    // 外部中止（用户发起新规划）不报错，静默丢弃旧结果
    if (externalSignal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (isAbortError(e)) {
      // 错误码格式：ERR_TIMEOUT|{秒}|{路径}，由 App 层按当前语言翻译展示
      throw new Error(`ERR_TIMEOUT|${timeoutMs / 1000}|${path}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  isMock: USE_MOCK,

  // ===== Mock 接口（演示流程保留） =====
  async submitRequest(request: Omit<UserRequest, 'id' | 'created_at'>): Promise<UserRequest> {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 300));
      return { ...request, id: mockUserRequest.id, created_at: new Date().toISOString() };
    }
    return fetchJSON<UserRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async getPlan(requestId: string): Promise<Plan> {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 300));
      return { ...mockPlan, request_id: requestId };
    }
    return fetchJSON<Plan>(`/plans?request_id=${requestId}`);
  },

  async getEvents(requestId: string): Promise<AgentEvent[]> {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 100));
      return mockEvents.map((e) => ({ ...e, id: `${e.id}_${requestId}` }));
    }
    return fetchJSON<AgentEvent[]>(`/events?request_id=${requestId}`);
  },

  async getDecisions(requestId: string): Promise<AgentDecision[]> {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 100));
      return mockDecisions.map((d) => ({ ...d, id: `${d.id}_${requestId}` }));
    }
    return fetchJSON<AgentDecision[]>(`/decisions?request_id=${requestId}`);
  },

  async resolveDecision(decisionId: string, optionId: string): Promise<AgentDecision> {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 200));
      return {
        ...mockDecisions[0],
        id: decisionId,
        status: 'approved',
        options: mockDecisions[0].options.map((o) => ({ ...o, selected: o.id === optionId })),
      };
    }
    return fetchJSON<AgentDecision>(`/decisions/${decisionId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ option_id: optionId }),
    });
  },

  async getActions(requestId: string): Promise<AgentAction[]> {
    if (USE_MOCK) {
      await new Promise((r) => setTimeout(r, 100));
      return mockActions.map((a) => ({ ...a, id: `${a.id}_${requestId}` }));
    }
    return fetchJSON<AgentAction[]>(`/actions?request_id=${requestId}`);
  },

  getMockActionResult(actionId: string): string | undefined {
    return mockActionResults[actionId];
  },

  // ===== 真实 API（BC 联调，B 服务器 Django） =====
  async submitPlan(request: Omit<UserRequest, 'id' | 'created_at'>, signal?: AbortSignal): Promise<Plan> {
    const raw = await fetchJSON<{ status: string; timeline: BTripTimeline }>('/plan/', {
      method: 'POST',
      body: JSON.stringify(userRequestToPlanBody(request)),
      signal,
      timeoutMs: TIMEOUT_PLAN_MS,
    });
    if (!raw.timeline || !raw.timeline.days?.length) {
      // 错误码由 App 层翻译（api 层无 i18n 上下文）
      throw new Error('ERR_PLAN_INVALID');
    }
    eventCursor = 0;
    lastTravelers = request.travelers;
    return timelineToPlan(raw.timeline, request.travelers);
  },

  async pollExecution(): Promise<void> {
    await fetchJSON('/execution/poll/', { method: 'POST' }).catch(() => {});
  },

  async fetchNewEvents(lang: 'en' | 'zh' = 'zh'): Promise<AgentEvent[]> {
    const raw = await fetchJSON<{ events: BMonitorEvent[]; count: number; total: number }>(
      `/events/?since=${eventCursor}`
    );
    eventCursor = raw.total ?? eventCursor + (raw.count ?? 0);
    return (raw.events ?? []).map((ev) => monitorEventToAgentEvent(ev, lang));
  },

  async fetchActions(): Promise<AgentAction[]> {
    const raw = await fetchJSON<{ actions: BActionItem[] }>('/actions/');
    return (raw.actions ?? []).map(bActionToAgentAction);
  },

  async fetchDecisions(lang: 'en' | 'zh' = 'zh'): Promise<AgentDecision[]> {
    const raw = await fetchJSON<{ replans: BReplanEntry[] }>('/replans/');
    return (raw.replans ?? [])
      .map((r) => replanToDecision(r, lang))
      .filter((d): d is AgentDecision => d !== null);
  },

  async fetchTimeline(): Promise<Plan | null> {
    const raw = await fetchJSON<BTripTimeline | { error: string }>('/timeline/');
    if ('error' in raw || !raw.days) return null;
    return timelineToPlan(raw, lastTravelers);
  },

  async approveAction(actionId: string): Promise<void> {
    await fetchJSON(`/actions/${actionId}/approve/`, { method: 'POST' });
  },

  async rejectAction(actionId: string): Promise<void> {
    await fetchJSON(`/actions/${actionId}/reject/`, { method: 'POST' });
  },

  // ===== B 侧只读缓存接口（0831 接入：tool-calls + hotel_tool 缓存） =====
  async fetchToolCalls(): Promise<ToolCallRecord[]> {
    const raw = await fetchJSON<{ tool_calls: ToolCallRecord[] }>('/tool-calls/');
    return raw.tool_calls ?? [];
  },

  async fetchHotels(): Promise<HotelCandidate[]> {
    const raw = await fetchJSON<{
      hotel_search_results?: Array<{ data?: { hotels?: HotelCandidate[] } }>;
      latest?: { data?: { hotels?: HotelCandidate[] } } | null;
    }>('/hotels/');
    const latest = raw.latest ?? raw.hotel_search_results?.[raw.hotel_search_results.length - 1];
    return latest?.data?.hotels ?? [];
  },

  // ===== B 侧工具直调：餐厅候选（时间线餐段换餐厅用） =====
  // 实测契约：POST /api/tools/food/invoke/ {city, location:"lng,lat", radius, limit}
  // 返回 {tool:"food", status:"ok", data:[{name, location, rating, price_per_person,
  //        open, distance_km, cuisine, open_hours, specialty, address, tel}]}
  async fetchNearbyRestaurants(
    city: string,
    location: string,
    radius = 2000,
    limit = 8,
  ): Promise<RestaurantOption[]> {
    const raw = await fetchJSON<{ status: string; data: RestaurantOption[] | null; error?: string }>(
      '/tools/food/invoke/',
      { method: 'POST', body: JSON.stringify({ city, location, radius, limit }) },
    );
    if (raw.status !== 'ok' || !Array.isArray(raw.data)) {
      // 该错误只在 MealPicker 内部被捕获并以 i18n 文案展示，此消息仅用于日志排查
      throw new Error(raw.error || 'restaurant candidates unavailable');
    }
    return raw.data;
  },
};
