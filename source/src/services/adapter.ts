import type {
  AgentAction,
  AgentDecision,
  AgentEvent,
  BActionItem,
  BMonitorEvent,
  BReplanEntry,
  BTripTimeline,
  Plan,
  PlanItem,
  PlanItemCategory,
  UserRequest,
} from '../types';

// A 侧 preferred_tags 只与景点标签（历史文化/摄影观景等抽象词）做交集；
// 具体景点名（南锣鼓巷/故宫）必须走 constraints.must_visit 才会被强制选入行程
const ATTRACTION_SUFFIX = /(寺|庙|宫|城|园|馆|街|巷|塔|山|院|区|镇|岛|滩|陵|府|桥|坛|湖|江|河|湾|林|洞|窟|坊|堂|斋|阁|庄|寨|渡|埠|站|场|大街|公园|乐园|水镇|草原|湿地|艺术区|博物馆)$/;
const ATTRACTION_CONTAINS = /([0-9]+|teamLab|环球|迪士尼|方特|欢乐谷)/;

function isAttractionName(kw: string): boolean {
  const s = kw.trim();
  if (!s || s.length < 2) return false;
  if (ATTRACTION_SUFFIX.test(s) && s.length >= 2) return true;
  if (ATTRACTION_CONTAINS.test(s)) return true;
  return false;
}

// 前端 UserRequest → B 侧 POST /api/plan/ 请求体
// 实测约束：content.constraints 里必须带 days 或 daily_travel_time，否则报「缺少有效的 days」
export function userRequestToPlanBody(request: Omit<UserRequest, 'id' | 'created_at'>) {
  const days = daysBetween(request.start_date, request.end_date);
  const mustVisit = request.preferences.filter(isAttractionName);
  const preferredTags = request.preferences.filter(kw => !isAttractionName(kw));
  return {
    days,
    content: {
      destination: request.destination,
      start_date: request.start_date,
      days,
      visitor_number: request.travelers,
      constraints: {
        budget: request.budget,
        must_visit: mustVisit,
        required_tags: [],
        dismissed_tags: [],
        walking_time: null,
        queue_time: null,
        days,
        daily_travel_time: request.constraints.max_daily_visit_hours * 60,
      },
      preferences: {
        preferred_tags: preferredTags,
        avoid_tags: [],
        required_tags: [],
        dismissed_tags: [],
        must_visit: mustVisit,
      },
    },
  };
}

const CATEGORY_MAP: Record<string, PlanItemCategory> = {
  scenic: 'sightseeing',
  food: 'food',
  hotel: 'lodging',
  transport: 'transport',
  shopping: 'activity',
};

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// B 的 TripTimeline（嵌套 days）→ 前端 Plan（扁平 items）
// B 响应里不含人数，由调用方传入最近一次提交的 travelers 用于回显
export function timelineToPlan(tl: BTripTimeline, travelers = 1): Plan {
  const items: PlanItem[] = [];
  for (const day of tl.days ?? []) {
    for (const p of day.items ?? []) {
      items.push({
        id: p.id || `d${day.day}-${p.name}`,
        day: day.day,
        time: p.arrival,
        place: {
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          category: CATEGORY_MAP[p.category] ?? 'activity',
        },
        activity: p.name,
        duration_minutes: p.end_time
          ? Math.max(0, hhmmToMinutes(p.end_time) - hhmmToMinutes(p.arrival))
          : 60,
        cost_estimate: p.price,
      });
    }
  }
  return {
    id: tl.id || 'plan_001',
    request_id: tl.id || 'plan_001',
    destination: tl.city,
    start_date: String(tl.start_date).slice(0, 10),
    end_date: String(tl.end_date).slice(0, 10),
    travelers,
    total_cost_estimate: tl.total_cost,
    items,
    status: 'confirmed',
    created_at: new Date().toISOString(),
  };
}

const EVENT_LABEL: Record<string, string> = {
  weather: '天气',
  traffic: '交通',
  scenic: '景点',
  food: '餐饮',
  booking: '预约',
  calendar: '日历',
};

function formatEventData(ev: BMonitorEvent): string {
  const d = (ev.data ?? {}) as Record<string, unknown>;
  switch (ev.event_type) {
    case 'weather':
      return `${ev.place}：${d.condition ?? ''} ${d.temperature_c ?? '--'}°C，降雨概率 ${d.rain_probability ?? 0}%`;
    case 'traffic': {
      if (d.error) return `${ev.place}：交通数据获取异常`;
      const delay = d.delay_min ? `，延误 ${d.delay_min} 分钟` : '';
      return `${ev.place}：${d.mode ?? '交通'}用时 ${d.duration_min ?? '--'} 分钟${delay}`;
    }
    case 'scenic':
      return `${ev.place}：当前排队 ${d.queue_min ?? 0} 分钟`;
    case 'booking':
      return `${ev.place}：预约状态变化`;
    case 'food':
      return `${ev.place}：餐饮信息观测`;
    default:
      return `${ev.place}：${ev.rule_name}`;
  }
}

// B 的 MonitorEvent（监控观测）→ 前端 AgentEvent（过程日志）
export function monitorEventToAgentEvent(ev: BMonitorEvent): AgentEvent {
  const label = EVENT_LABEL[ev.event_type] ?? ev.event_type;
  const isError = Boolean(ev.data && typeof ev.data === 'object' && 'error' in (ev.data as object));
  return {
    id: ev.event_id,
    type: isError ? 'error' : 'observation',
    content: `【${label}】${formatEventData(ev)}`,
    metadata: { ...(ev.data as object ?? {}), impact_score: ev.impact_score },
    timestamp: ev.observed_at,
  };
}

const ACTION_STATUS_MAP: Record<string, AgentAction['status']> = {
  pending: 'pending',
  approved: 'running',
  executed: 'completed',
  rejected: 'failed',
  blocked: 'failed',
};

export function bActionToAgentAction(a: BActionItem): AgentAction {
  return {
    id: a.action_id,
    tool: a.type || 'BOOK_TICKET',
    description: a.description || a.title,
    status: ACTION_STATUS_MAP[a.status] ?? 'pending',
    input: { target: a.target, date: a.date, quantity: a.quantity, permission: a.permission },
    result: a.title,
    started_at: a.created_at,
  };
}

// B 的 ReplanEntry（自动重规划记录）→ 前端 AgentDecision（决策卡片）
export function replanToDecision(entry: BReplanEntry): AgentDecision | null {
  const d = entry.decision;
  if (!d) return null;
  return {
    id: entry.id,
    type: 'itinerary_review',
    title: '智能重规划',
    description: d.reason || '',
    options: (d.diff_summary ?? []).map((s, i) => ({
      id: `${entry.id}-${i}`,
      label: s,
      description: s,
      selected: true,
    })),
    status: 'approved',
    timestamp: entry.timestamp,
  };
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
  return Math.round((e - s) / 86400000) + 1;
}
