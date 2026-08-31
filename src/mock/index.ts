import userRequestData from './data/user_request.json';
import planData from './data/plan.json';
import eventData from './data/event.json';
import actionData from './data/action.json';
import type { UserRequest, Plan, AgentEvent, AgentAction } from '../types';

export const mockUserRequest = userRequestData as UserRequest;
export const mockPlan = planData as Plan;
export const mockEvents = eventData as AgentEvent[];
export const mockActions = actionData as AgentAction[];

export const mockActionResults: Record<string, string> = {
  act_003: 'Reservation confirmed for 2 at 12:30',
  act_004: 'Sunny, 18-22°C. Light jacket recommended.',
  act_005: 'Itinerary compiled with 10 items across 4 days',
};
