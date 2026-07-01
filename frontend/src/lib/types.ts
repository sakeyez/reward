export type UserStatus = "active" | "disabled";

export interface LevelInfo {
  code: string;
  name: string;
  label: string;
  current_level_points: number;
  next_level_points: number | null;
  progress_percent: number;
  points_to_next_level: number;
  is_max_level: boolean;
}

export interface User {
  id: number;
  username: string | null;
  phone: string | null;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  current_points: number;
  streak_days: number;
  level?: LevelInfo;
  status: UserStatus;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  username?: string;
  phone?: string;
  email?: string;
  password: string;
  display_name: string;
}

export type CheckinStatus = "draft" | "submitted" | "analyzing" | "scored" | "rejected";

export interface CheckinScoreDimension {
  id: number;
  dimension_code: string;
  dimension_name: string;
  score: number;
  sort_order: number;
}

export interface Checkin {
  id: number;
  checkin_date: string;
  content_text: string | null;
  image_url: string | null;
  note_image_url: string | null;
  exercise_image_url: string | null;
  note_images: string[];
  exercise_images: string[];
  study_time_minutes: number;
  question_count: number;
  note_words: number;
  neatness_score: number | null;
  accuracy_score: number | null;
  note_quality_score: number | null;
  risk_factor: number;
  time_component: number;
  note_component: number;
  exercise_component: number;
  neatness_coefficient: number;
  accuracy_coefficient: number;
  note_quality_coefficient: number;
  streak_coefficient: number;
  ai_error: string | null;
  status: CheckinStatus;
  total_score: number | null;
  awarded_points: number;
  ai_comment: string | null;
  ai_advice: string | null;
  created_at: string;
  updated_at: string;
  score_dimensions: CheckinScoreDimension[];
}

export interface CheckinCalendarItem {
  id: number;
  checkin_date: string;
  day: number;
  status: CheckinStatus;
  total_score: number | null;
  awarded_points: number;
}

export interface CheckinCalendarResponse {
  year: number;
  month: number;
  days: CheckinCalendarItem[];
}

export type PointTransactionType =
  | "checkin_reward"
  | "redemption_cost"
  | "admin_adjustment"
  | "refund";

export interface PointTransaction {
  id: number;
  type: PointTransactionType;
  amount: number;
  balance_after: number;
  related_type: string | null;
  related_id: string | null;
  reason: string;
  created_by?: number | null;
  created_at: string;
}

export interface PointAccount {
  current_points: number;
  streak_days: number;
  transactions: PointTransaction[];
}

export type RewardStatus = "active" | "inactive";

export interface Reward {
  id: number;
  name: string;
  category: string;
  description: string | null;
  image_url: string | null;
  cost_points: number;
  stock: number | null;
  status: RewardStatus;
  can_redeem: boolean;
  points_shortfall: number;
}

export type RedemptionStatus = "created" | "fulfilled" | "cancelled" | "refunded";

export interface Redemption {
  id: number;
  reward_id: number;
  reward_name: string;
  cost_points: number;
  status: RedemptionStatus;
  receiver_name: string | null;
  receiver_phone: string | null;
  receiver_address: string | null;
  created_at: string;
}

export type RouteName = "home" | "checkin" | "result" | "calendar" | "shopGoal" | "shop" | "profile" | "badges";

export interface AdminSummary {
  users_total: number;
  active_users: number;
  today_checkins: number;
  points_earned: number;
  points_spent: number;
  pending_redemptions: number;
  rewards_total: number;
}

export interface AdminUser {
  id: number;
  username: string | null;
  phone: string | null;
  email: string | null;
  display_name: string;
  current_points: number;
  streak_days: number;
  status: UserStatus;
  roles: string[];
  created_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminCheckin {
  id: number;
  user_id: number;
  user_display_name: string;
  checkin_date: string;
  content_text: string | null;
  image_url: string | null;
  status: CheckinStatus;
  total_score: number | null;
  awarded_points: number;
  ai_comment: string | null;
  ai_error: string | null;
  created_at: string;
}

export interface AdminAiSetting {
  enabled: boolean;
  base_url: string;
  model: string;
  api_type: string;
  api_key_masked: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
  can_edit: boolean;
}

export interface AdminAiSettingPayload {
  enabled?: boolean;
  base_url?: string;
  model?: string;
  api_key?: string | null;
}

export interface AdminAiSettingTestResult {
  status: string;
  message: string;
}

export interface AdminPointTransaction extends PointTransaction {
  user_id: number;
  user_display_name: string;
  created_by: number | null;
}

export interface AdminReward extends Omit<Reward, "can_redeem" | "points_shortfall"> {
  created_at: string;
}

export interface AdminRewardList {
  items: AdminReward[];
  total: number;
}

export interface AdminRewardPayload {
  name: string;
  category: string;
  description?: string | null;
  image_url?: string | null;
  cost_points: number;
  stock?: number | null;
  status: RewardStatus;
}

export interface AdminRedemption extends Redemption {
  user_id: number;
  user_display_name: string;
}
