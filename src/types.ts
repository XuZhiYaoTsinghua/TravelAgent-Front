export interface TripConstraints {
  max_daily_visit_hours: number;
  max_daily_commute_minutes: number;
}

// 城际交通偏好：A 侧 travel_priority 枚举的 C 端子集（earliest 未在 UI 暴露）
export type TransportPreference = 'air' | 'rail' | 'speed' | 'cost';

export interface UserRequest {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  budget: number;
  constraints: TripConstraints;
  preferences: string[];
  free_text_requirement: string;
  // 跨城交通：A 侧已消费（B1 映射 origin；travel_schedule 驱动城际段生成）
  departure_location?: string;
  return_location?: string;
  // 24 小时制 HH:MM；填写后随 travel_schedule 透传 A 侧，缺省由 A 侧注入 09:00
  departure_time?: string;
  // 城际交通偏好（映射 A 侧 preferences.travel_priority），缺省不限
  transport_preference?: TransportPreference;
  departure_coords?: [number, number]; // [lat, lng] GPS 定位
  return_coords?: [number, number];
  created_at: string;
}

export type PlanItemCategory = 'transport' | 'food' | 'sightseeing' | 'lodging' | 'activity';

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PlanItemCategory;
  description?: string;
}

export interface PlanItem {
  id: string;
  day: number;
  time: string;
  place: Place;
  activity: string;
  duration_minutes: number;
  cost_estimate: number;
  distance_km?: number; // transport 段通勤距离（由前后地点坐标估算）
  // 交通段出行方式（规范化 key：driving/train/air/walk/riding/transit/taxi）。
  // 来源优先级：B details.mode > 名称推断（「（自驾）」「高铁」等）> 无（渲染回退汽车图标）
  transport_mode?: string;
  // 餐段被用户从候选列表手动选定（区别于 A 侧默认安排）
  custom_meal?: boolean;
}

// B 侧 food 工具直调返回的候选餐厅（POST /api/tools/food/invoke/，附近搜索）
export interface RestaurantOption {
  name: string;
  location: string; // "lng,lat"
  rating: number;
  price_per_person: number;
  open: boolean;
  distance_km: number;
  cuisine: string;
  open_hours?: string;
  specialty?: string;
  address?: string;
  tel?: string;
}

export interface Plan {
  id: string;
  request_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  total_cost_estimate: number;
  items: PlanItem[];
  status: 'draft' | 'confirmed' | 'booked';
  created_at: string;
}

export type EventType = 'thinking' | 'action' | 'observation' | 'final' | 'error';

export interface AgentEvent {
  id: string;
  type: EventType;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export type DecisionStatus = 'pending' | 'approved' | 'rejected';
export type DecisionType = 'itinerary_review' | 'budget_approval' | 'booking_confirmation' | 'alternative_option';

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  selected: boolean;
}

export interface AgentDecision {
  id: string;
  type: DecisionType;
  title: string;
  description: string;
  options: DecisionOption[];
  status: DecisionStatus;
  timestamp: string;
}

export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentAction {
  id: string;
  tool: string;
  description: string;
  status: ActionStatus;
  input?: Record<string, unknown>;
  result?: string;
  started_at?: string;
  completed_at?: string;
}

// ===== B 侧契约 raw 类型（与 B 仓库 core/schemas.py 对齐，BC 联调用）=====
export interface BPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string; // scenic / food / hotel / transport / shopping
  arrival: string;
  end_time: string;
  open_time: string;
  queue_min: number;
  ticket_required: boolean;
  price: number;
  // B2 Place 契约扩展（0828）：meal 段餐厅详情，plan 层已产出
  restaurant_name?: string;
  cuisine?: string[];
  average_cost?: number;
  // 0831 交通方式透传：城际段已产出（mode/kind/legs/candidates），
  // 市内段 B 侧按距离分档填 mode 后自动生效（前端零改动，见 adapter.normalizeTransportMode）
  details?: BTransportDetails;
}

// transport 段的分段详情（B 契约里 Place.details；字段均为可选——城际/市内段填充程度不同）
export interface BTransportDetails {
  mode?: string; // driving / train / air / walk / riding / transit / taxi
  kind?: string; // outbound / return（城际去/返程）
  from?: string;
  to?: string;
  distance_km?: number; // A 侧 timeline 写入的该段真实距离
  transit_text?: string; // 工具层中文方式描述（如「公交」）
  legs?: unknown[];
  [key: string]: unknown; // B 侧后续扩展字段不截断
}

export interface BDayPlan {
  day: number;
  date: string;
  items: BPlace[];
}

export interface BTripTimeline {
  id: string;
  city: string;
  start_date: string;
  end_date: string;
  days: BDayPlan[];
  total_cost: number;
  walking_distance: number;
}

export interface BMonitorEvent {
  event_id: string;
  event_type: string; // weather / traffic / scenic / food / booking / calendar
  place: string;
  observed_at: string;
  rule_name: string;
  spot_id: string;
  data: Record<string, unknown> | null;
  impact_score: number;
}

export interface BActionItem {
  action_id: string;
  title: string;
  description: string;
  status: string; // pending / approved / executed / rejected / blocked
  permission: string; // auto / confirm / manual
  target: string;
  created_at: string;
  type: string;
  date: string;
  quantity: number;
}

export interface BReplanEntry {
  id: string;
  timestamp: string;
  events: BMonitorEvent[];
  current_timeline: BTripTimeline;
  context: Record<string, unknown>;
  decision: {
    new_timeline: BTripTimeline | null;
    reason: string;
    diff_summary: string[];
    need_replan: boolean;
    impact: number;
    affected_spots: string[];
  } | null;
}

// ===== B 侧工具调用记录（GET /api/tool-calls/，0831 接入）=====
export interface ToolCallRecord {
  tool: string; // scenic / food / hotel / map
  arguments: Record<string, unknown>;
  status: string; // ok / error
  source: string; // live / mock
  elapsed_ms: number;
  timestamp: string;
  error: string | null;
  has_data: boolean;
  data?: unknown;
}

// ===== B 侧酒店工具缓存（GET /api/hotels/，rollinggo hotel_tool，0831 接入）=====
// rollinggo 真源数据字段可缺省：id 为数字、rating 常为 null、无 name_en/booking_url
export interface HotelCandidate {
  id: string | number;
  name: string;
  name_en?: string | null;
  brand?: string | null;
  location?: { lat: number; lng: number } | null;
  star?: number | null;
  rating?: number | null;
  price_per_night?: number | null;
  address?: string | null;
  tags?: string[] | null;
  booking_url?: string | null;
  image_url?: string | null;
  open?: boolean | null;
}

// ===== Notifications =====
export type NotificationType = 'plan_update' | 'delay' | 'weather' | 'booking' | 'info';
export type NotificationPriority = 'high' | 'medium' | 'low';

export interface TravelNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  affected_item_id?: string;
  action_label?: string;
}

// ===== View routing (lightweight, no router lib) =====
export type AppView = 'dashboard' | 'reasoning' | 'notifications';

// Activity status derived from current time vs schedule
export type ActivityStatus = 'upcoming' | 'active' | 'completed';
