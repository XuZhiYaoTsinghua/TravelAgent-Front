export interface TripConstraints {
  max_daily_visit_hours: number;
  max_daily_commute_minutes: number;
}

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
