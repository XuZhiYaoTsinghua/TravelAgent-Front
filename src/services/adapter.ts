import type {
  AgentAction,
  AgentDecision,
  AgentEvent,
  BActionItem,
  BMonitorEvent,
  BPlace,
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
  // A 侧 _ensure_default_travel_schedule 四字段全有才保留，缺一即整体覆盖默认值；
  // 故用户填了出发时间就必须补齐返程（返程时刻前端不采集，沿用 A 侧默认 18:00）
  const travelSchedule = request.departure_time
    ? {
        departure_date: request.start_date,
        departure_time: request.departure_time,
        return_date: request.end_date,
        return_time: '18:00',
      }
    : undefined;
  return {
    days,
    content: {
      destination: request.destination,
      start_date: request.start_date,
      days,
      visitor_number: request.travelers,
      // B1 已映射：departure_location → content.origin（城际来去程依据）
      departure_location: request.departure_location ?? null,
      return_location: request.return_location ?? null,
      departure_coords: request.departure_coords ?? null,
      return_coords: request.return_coords ?? null,
      ...(travelSchedule ? { travel_schedule: travelSchedule } : {}),
      // 六① 修复：备注字段此前组装请求体时被丢弃，从未离开浏览器；
      // B 侧 _parse_free_text_requirement() 检测到非空时先调 LLM 解析再规划（失败回退无备注）
      free_text_requirement: request.free_text_requirement || '',
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
        // 城际交通偏好（A 侧 travel_priority 枚举：rail/air/speed/earliest/cost）
        ...(request.transport_preference ? { travel_priority: request.transport_preference } : {}),
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

// meal 段展示：BPlace.name 是餐段类型（午餐/晚餐），B2 扩展字段带餐厅详情
function mealActivity(p: BPlace): string {
  const parts: string[] = [p.name];
  if (p.cuisine?.length) parts.push(p.cuisine.join('/'));
  if (p.average_cost && p.average_cost > 0) parts.push(`人均 ¥${Math.round(p.average_cost)}`);
  return parts.join(' · ');
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// transport 段坐标为 (0,0)，用同一天内前后最近的带坐标地点估算通勤距离
// 直线距离 × 1.35 路网绕行系数（城市路网经验值），仅作展示参考。
// B 侧 details.distance_km 已带真实距离的段不再覆盖（0831：优先权威值）。
function estimateTransportDistances(items: PlanItem[]): void {
  const hasCoord = (it: PlanItem) => it.place.lat !== 0 && it.place.lng !== 0;
  items.forEach((it, i) => {
    if (it.place.category !== 'transport') return;
    if (it.distance_km != null) return; // B 真实距离优先
    let prev: PlanItem | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (items[j].day !== it.day) break;
      if (hasCoord(items[j])) { prev = items[j]; break; }
    }
    let next: PlanItem | null = null;
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].day !== it.day) break;
      if (hasCoord(items[j])) { next = items[j]; break; }
    }
    if (prev && next) {
      const km = haversineKm(prev.place.lat, prev.place.lng, next.place.lat, next.place.lng) * 1.35;
      if (km > 0.05) it.distance_km = Math.round(km * 10) / 10;
    }
  });
}

// ---------------------------------------------------------------------------
// 交通方式规范化（0831）：B/工具层 mode 枚举 + 名称关键词双通道
// ---------------------------------------------------------------------------
// B 侧已知取值：城际 details.mode（driving 实测；工具层另有 train/air）、
// 工具层四模式 transit/driving/riding/walk、TrafficTool 的 taxi。
// 名称兜底：A 侧城际段名自带方式后缀（「广州 → 北京（自驾）」「（高铁）」「（航班）」），
// transit_text 工具层返回中文方式描述（「公交」），一并走同一张归一表。
const MODE_ALIAS: Record<string, string> = {
  driving: 'driving', car: 'driving',
  taxi: 'taxi',
  train: 'train', rail: 'train', railway: 'train',
  air: 'air', flight: 'air', plane: 'air',
  walk: 'walk', walking: 'walk',
  riding: 'riding', bike: 'riding', bicycling: 'riding',
  transit: 'transit', bus: 'transit', subway: 'transit', metro: 'transit',
  驾车: 'driving', 自驾: 'driving',
  打车: 'taxi', 出租: 'taxi',
  高铁: 'train', 动车: 'train', 火车: 'train', 列车: 'train',
  航班: 'air', 飞机: 'air',
  步行: 'walk',
  骑行: 'riding', 单车: 'riding',
  公交: 'transit', 地铁: 'transit', 巴士: 'transit',
};

const NAME_MODE_RULES: Array<[RegExp, string]> = [
  [/自驾|驾车/, 'driving'],
  [/打车|出租/, 'taxi'],
  [/高铁|动车|火车|列车/, 'train'],
  [/航班|飞机/, 'air'],
  [/步行/, 'walk'],
  [/骑行|单车/, 'riding'],
  [/公交|地铁|巴士/, 'transit'],
];

export function normalizeTransportMode(mode?: string | null, name?: string | null): string | undefined {
  const key = (mode ?? '').trim().toLowerCase();
  if (key && MODE_ALIAS[key]) return MODE_ALIAS[key];
  const n = name ?? '';
  for (const [re, m] of NAME_MODE_RULES) {
    if (re.test(n)) return m;
  }
  return undefined;
}

// B 的 TripTimeline（嵌套 days）→ 前端 Plan（扁平 items）
// B 响应里不含人数，由调用方传入最近一次提交的 travelers 用于回显
export function timelineToPlan(tl: BTripTimeline, travelers = 1): Plan {
  const items: PlanItem[] = [];
  const days = tl.days ?? [];
  const maxDay = days.reduce((mx, d) => Math.max(mx, d.day), 0);
  for (const day of days) {
    for (const p of day.items ?? []) {
      // 屏蔽 B 侧 planner 的"填充槽"占位条目。实测（2026-08-31 北京规划）：
      // "等待晚餐时间"的 category 是 scenic 而非 food，故不能按 category 过滤，
      // 必须按名称模式统一屏蔽（等待午餐时间/等待晚餐时间/等待景点开放/等待酒店入住…）
      if (/^等待/.test(p.name) || /等待.{0,6}(时间|开放|入住|闭馆)/.test(p.name)) continue;
      // 屏蔽无餐厅的空餐段槽：name 只是"午餐/晚餐"等餐段名且无 restaurant_name，
      // 展示无价值且会与真实餐厅条目重复出现
      if (p.category === 'food' && !p.restaurant_name && /^(早餐|午餐|晚餐|夜宵|宵夜)$/.test(p.name)) continue;
      // 屏蔽最后一天的酒店（返程日不再住宿）
      if (p.category === 'hotel' && day.day === maxDay) continue;
      const isMeal = p.category === 'food' && p.restaurant_name;
      // 交通方式：details.mode / transit_text 优先，名称关键词兜底（城际段名带「（自驾）」等）
      const transportMode =
        p.category === 'transport'
          ? normalizeTransportMode(p.details?.mode ?? p.details?.transit_text, p.name)
          : undefined;
      // A 侧 timeline 会把该段真实距离写进 details.distance_km（市内餐段接驳等）；
      // 有权威值时跳过前端 haversine 估算
      const realDistance =
        p.category === 'transport' && typeof p.details?.distance_km === 'number'
          ? Math.round(p.details.distance_km * 10) / 10
          : undefined;
      items.push({
        id: p.id || `d${day.day}-${p.name}`,
        day: day.day,
        time: p.arrival,
        place: {
          id: p.id,
          name: isMeal ? (p.restaurant_name as string) : p.name,
          lat: p.lat,
          lng: p.lng,
          category: CATEGORY_MAP[p.category] ?? 'activity',
        },
        activity: isMeal ? mealActivity(p) : p.name,
        duration_minutes: p.end_time
          ? Math.max(0, hhmmToMinutes(p.end_time) - hhmmToMinutes(p.arrival))
          : 60,
        cost_estimate: p.price,
        ...(transportMode ? { transport_mode: transportMode } : {}),
        ...(realDistance != null && realDistance > 0 ? { distance_km: realDistance } : {}),
        ...(p.details?.dining_note ? { dining_note: String(p.details.dining_note) } : {}),
        ...(p.category === 'transport' && p.details?.from ? { transport_from: String(p.details.from) } : {}),
        ...(p.category === 'transport' && p.details?.to ? { transport_to: String(p.details.to) } : {}),
        ...(p.category === 'transport' && p.details?.transit_text ? { transit_text: String(p.details.transit_text) } : {}),
      });
    }
  }
  estimateTransportDistances(items);
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

// 监控事件类型标签（UI 文案，按语言输出；事件体本身是 B 侧中文数据）
const EVENT_LABEL: Record<'en' | 'zh', Record<string, string>> = {
  zh: { weather: '天气', traffic: '交通', scenic: '景点', food: '餐饮', booking: '预约', calendar: '日历' },
  en: { weather: 'Weather', traffic: 'Traffic', scenic: 'Attraction', food: 'Food', booking: 'Booking', calendar: 'Calendar' },
};

function formatEventData(ev: BMonitorEvent, lang: 'en' | 'zh'): string {
  const d = (ev.data ?? {}) as Record<string, unknown>;
  const zh = lang === 'zh';
  switch (ev.event_type) {
    case 'weather':
      return zh
        ? `${ev.place}：${d.condition ?? ''} ${d.temperature_c ?? '--'}°C，降雨概率 ${d.rain_probability ?? 0}%`
        : `${ev.place}: ${d.condition ?? ''} ${d.temperature_c ?? '--'}°C, rain chance ${d.rain_probability ?? 0}%`;
    case 'traffic': {
      if (d.error) return zh ? `${ev.place}：交通数据获取异常` : `${ev.place}: traffic data unavailable`;
      const delay = d.delay_min ? (zh ? `，延误 ${d.delay_min} 分钟` : `, ${d.delay_min} min delay`) : '';
      const mode = d.mode ?? (zh ? '交通' : 'transit');
      return zh
        ? `${ev.place}：${mode}用时 ${d.duration_min ?? '--'} 分钟${delay}`
        : `${ev.place}: ${mode} takes ${d.duration_min ?? '--'} min${delay}`;
    }
    case 'scenic':
      return zh ? `${ev.place}：当前排队 ${d.queue_min ?? 0} 分钟` : `${ev.place}: queue ${d.queue_min ?? 0} min`;
    case 'booking':
      return zh ? `${ev.place}：预约状态变化` : `${ev.place}: booking status changed`;
    case 'food':
      return zh ? `${ev.place}：餐饮信息观测` : `${ev.place}: dining observation`;
    default:
      return `${ev.place}：${ev.rule_name}`;
  }
}

// B 的 MonitorEvent（监控观测）→ 前端 AgentEvent（过程日志）
export function monitorEventToAgentEvent(ev: BMonitorEvent, lang: 'en' | 'zh' = 'zh'): AgentEvent {
  const label = EVENT_LABEL[lang][ev.event_type] ?? ev.event_type;
  const isError = Boolean(ev.data && typeof ev.data === 'object' && 'error' in (ev.data as object));
  // 标签括号随语言：中文【】、英文 []（place/condition 等值是 B 侧中文数据，原样透传）
  const wrapped = lang === 'zh' ? `【${label}】` : `[${label}]`;
  return {
    id: ev.event_id,
    type: isError ? 'error' : 'observation',
    content: `${wrapped}${formatEventData(ev, lang)}`,
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
export function replanToDecision(entry: BReplanEntry, lang: 'en' | 'zh' = 'zh'): AgentDecision | null {
  const d = entry.decision;
  if (!d) return null;
  return {
    id: entry.id,
    type: 'itinerary_review',
    title: lang === 'zh' ? '智能重规划' : 'Auto Replan',
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
