import type {
  AdminCheckin,
  AdminAiSetting,
  AdminAiSettingPayload,
  AdminAiSettingTestResult,
  AdminPointTransaction,
  AdminRedemption,
  AdminReward,
  AdminRewardList,
  AdminRewardPayload,
  AdminSummary,
  AdminUser,
  Checkin,
  CheckinCalendarResponse,
  LoginRequest,
  Paginated,
  PointAccount,
  PointTransactionType,
  Redemption,
  RegisterRequest,
  Reward,
  RedemptionStatus,
  RewardStatus,
  SmsCodeResponse,
  SmsLoginRequest,
  TokenResponse,
  User,
  UserStatus
} from "./types";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(formatApiError(detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

export function assetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.startsWith("/")) return url;
  return `${BASE_PATH}${url}`;
}

function formatApiError(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) return String(item.msg);
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (detail && typeof detail === "object" && "detail" in detail) {
    return formatApiError((detail as { detail: unknown }).detail);
  }
  return "请求失败，请稍后再试";
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const detail = contentType.includes("application/json") ? await response.json() : await response.text();
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  register(payload: RegisterRequest) {
    return request<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  login(payload: LoginRequest) {
    return request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  sendSmsCode(phone: string) {
    return request<SmsCodeResponse>("/api/auth/sms/send-code", {
      method: "POST",
      body: JSON.stringify({ phone })
    });
  },
  smsLogin(payload: SmsLoginRequest) {
    return request<TokenResponse>("/api/auth/sms/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  me(token: string) {
    return request<User>("/api/users/me", {}, token);
  },
  updateMe(token: string, formData: FormData) {
    return request<User>("/api/users/me", {
      method: "PATCH",
      body: formData
    }, token);
  },
  createCheckin(token: string, formData: FormData) {
    return request<Checkin>("/api/checkins", {
      method: "POST",
      body: formData
    }, token);
  },
  listCheckins(token: string, limit = 20) {
    return request<Checkin[]>(`/api/checkins/me?limit=${limit}`, {}, token);
  },
  calendar(token: string, year: number, month: number) {
    return request<CheckinCalendarResponse>(
      `/api/checkins/calendar?year=${year}&month=${month}`,
      {},
      token
    );
  },
  points(token: string) {
    return request<PointAccount>("/api/points/me", {}, token);
  },
  rewards(token: string) {
    return request<Reward[]>("/api/rewards", {}, token);
  },
  redeem(token: string, rewardId: number) {
    return request<Redemption>("/api/redemptions", {
      method: "POST",
      body: JSON.stringify({ reward_id: rewardId })
    }, token);
  },
  redemptions(token: string) {
    return request<Redemption[]>("/api/redemptions/me", {}, token);
  },
  adminSummary(token: string) {
    return request<AdminSummary>("/api/admin/summary", {}, token);
  },
  adminUsers(token: string, params: { q?: string; limit?: number; offset?: number } = {}) {
    return request<Paginated<AdminUser>>(`/api/admin/users${queryString(params)}`, {}, token);
  },
  adminUpdateUser(token: string, userId: number, status: UserStatus) {
    return request<AdminUser>(`/api/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }, token);
  },
  adminAdjustPoints(token: string, userId: number, payload: { amount: number; reason: string }) {
    return request<AdminPointTransaction>(`/api/admin/users/${userId}/point-adjustments`, {
      method: "POST",
      body: JSON.stringify(payload)
    }, token);
  },
  adminCheckins(
    token: string,
    params: { user_id?: number; status?: string; date_from?: string; date_to?: string; limit?: number; offset?: number } = {}
  ) {
    return request<Paginated<AdminCheckin>>(`/api/admin/checkins${queryString(params)}`, {}, token);
  },
  adminResetCheckin(token: string, checkinId: number) {
    return request<void>(`/api/admin/checkins/${checkinId}`, {
      method: "DELETE"
    }, token);
  },
  adminRetryCheckin(token: string, checkinId: number) {
    return request<AdminCheckin>(`/api/admin/checkins/${checkinId}/retry`, {
      method: "POST"
    }, token);
  },
  adminPointTransactions(
    token: string,
    params: { user_id?: number; type?: PointTransactionType; limit?: number; offset?: number } = {}
  ) {
    return request<Paginated<AdminPointTransaction>>(
      `/api/admin/point-transactions${queryString(params)}`,
      {},
      token
    );
  },
  adminRewards(token: string) {
    return request<AdminRewardList>("/api/admin/rewards", {}, token);
  },
  adminCreateReward(token: string, payload: AdminRewardPayload) {
    return request<AdminReward>("/api/admin/rewards", {
      method: "POST",
      body: JSON.stringify(payload)
    }, token);
  },
  adminUpdateReward(token: string, rewardId: number, payload: Partial<AdminRewardPayload>) {
    return request<AdminReward>(`/api/admin/rewards/${rewardId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }, token);
  },
  adminRedemptions(token: string, params: { status?: RedemptionStatus; limit?: number; offset?: number } = {}) {
    return request<Paginated<AdminRedemption>>(`/api/admin/redemptions${queryString(params)}`, {}, token);
  },
  adminUpdateRedemption(token: string, redemptionId: number, status: RedemptionStatus) {
    return request<AdminRedemption>(`/api/admin/redemptions/${redemptionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }, token);
  },
  adminAiSettings(token: string) {
    return request<AdminAiSetting>("/api/admin/ai-settings", {}, token);
  },
  adminUpdateAiSettings(token: string, payload: AdminAiSettingPayload) {
    return request<AdminAiSetting>("/api/admin/ai-settings", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }, token);
  },
  adminTestAiSettings(token: string, payload: AdminAiSettingPayload) {
    return request<AdminAiSettingTestResult>("/api/admin/ai-settings/test", {
      method: "POST",
      body: JSON.stringify(payload)
    }, token);
  }
};

function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}
