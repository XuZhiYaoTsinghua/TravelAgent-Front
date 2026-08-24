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

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

let eventCursor = 0;
let lastTravelers = 1;

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error || `API error ${res.status}`);
  }
  return data as T;
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
  async submitPlan(request: Omit<UserRequest, 'id' | 'created_at'>): Promise<Plan> {
    const raw = await fetchJSON<{ status: string; timeline: BTripTimeline }>('/plan/', {
      method: 'POST',
      body: JSON.stringify(userRequestToPlanBody(request)),
    });
    if (!raw.timeline || !raw.timeline.days?.length) {
      throw new Error('规划失败：未生成有效行程，请确认目的地（当前支持北京/上海）');
    }
    eventCursor = 0;
    lastTravelers = request.travelers;
    return timelineToPlan(raw.timeline, request.travelers);
  },

  async pollExecution(): Promise<void> {
    await fetchJSON('/execution/poll/', { method: 'POST' }).catch(() => {});
  },

  async fetchNewEvents(): Promise<AgentEvent[]> {
    const raw = await fetchJSON<{ events: BMonitorEvent[]; count: number; total: number }>(
      `/events/?since=${eventCursor}`
    );
    eventCursor = raw.total ?? eventCursor + (raw.count ?? 0);
    return (raw.events ?? []).map(monitorEventToAgentEvent);
  },

  async fetchActions(): Promise<AgentAction[]> {
    const raw = await fetchJSON<{ actions: BActionItem[] }>('/actions/');
    return (raw.actions ?? []).map(bActionToAgentAction);
  },

  async fetchDecisions(): Promise<AgentDecision[]> {
    const raw = await fetchJSON<{ replans: BReplanEntry[] }>('/replans/');
    return (raw.replans ?? [])
      .map(replanToDecision)
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
};
