import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const V1 = `${API_BASE}/v1`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: { error?: string; message?: string },
  ) {
    super(body?.message ?? body?.error ?? `${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let body: Record<string, unknown> | undefined;
    try {
      body = await res.json();
    } catch {
      /* empty */
    }
    throw new ApiError(res.status, res.statusText, body as ApiError['body']);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Low-level helpers ───────────────────────────────────────────

export function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(`${V1}${path}`, options);
}

function get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const searchParams = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) searchParams.set(k, v);
    }
  }
  const qs = searchParams.toString();
  return apiFetch<T>(qs ? `${path}?${qs}` : path);
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

function del<T = void>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}

// ── Health ──────────────────────────────────────────────────────

export const healthApi = {
  check: () => request<{ status: string }>(`${API_BASE}/health`),
};

// ── Auth ────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
  currency: string;
  onboardedAt: string | null;
  stats: { connectedBanks: number; totalAccounts: number; transactionCount: number };
}

export const authApi = {
  /** Create internal user on first sign-in. 409 = already registered (safe to ignore). */
  register: (body?: { displayName?: string; timezone?: string; currency?: string }) =>
    post<{ data: UserProfile }>('/auth/register', body ?? {}),

  me: () => get<{ data: UserProfile }>('/auth/me'),

  updateProfile: (body: { displayName?: string; timezone?: string; currency?: string }) =>
    patch<{ data: UserProfile }>('/auth/me', body),

  deleteAccount: () => del<{ data: { message: string } }>('/auth/me'),

  onboardingStatus: () =>
    get<{ data: { isComplete: boolean; steps: { accountCreated: boolean; bankConnected: boolean; firstSyncComplete: boolean } } }>('/auth/onboarding'),

  completeOnboarding: () => post<{ data: { success: boolean } }>('/auth/onboarding/complete'),
};

// ── Accounts ────────────────────────────────────────────────────

export const accountsApi = {
  list: () => get<{ data: unknown[] }>('/accounts'),
  get: (id: string) => get<{ data: unknown }>(`/accounts/${id}`),
  sync: (id: string) => post<{ data: unknown }>(`/accounts/${id}/sync`),
};

// ── Transactions ────────────────────────────────────────────────

export interface TransactionFilters {
  accountId?: string;
  category?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: string;
}

export const transactionsApi = {
  list: (filters?: TransactionFilters) => get<{ data: unknown[]; nextCursor?: string }>('/transactions', filters as Record<string, string | undefined>),
  get: (id: string) => get<{ data: unknown }>(`/transactions/${id}`),
  updateCategory: (id: string, categoryId: string) =>
    patch<{ data: unknown }>(`/transactions/${id}/category`, { categoryId }),
};

// ── Budgets ─────────────────────────────────────────────────────

export const budgetsApi = {
  list: () => get<{ data: unknown[] }>('/budgets'),
  get: (id: string) => get<{ data: unknown }>(`/budgets/${id}`),
  create: (body: { categoryId: string; limitAmount: number; period: string }) =>
    post<{ data: unknown }>('/budgets', body),
  update: (id: string, body: { limitAmount?: number; period?: string; isActive?: boolean }) =>
    patch<{ data: unknown }>(`/budgets/${id}`, body),
  delete: (id: string) => del(`/budgets/${id}`),
  history: (id: string) => get<{ data: unknown[] }>(`/budgets/${id}/history`),
};

// ── Recurring Payments ──────────────────────────────────────────

export const recurringApi = {
  list: () => get<{ data: unknown[] }>('/recurring'),
};

// ── Analytics ───────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: () => get<{ data: DashboardResponse }>('/analytics/dashboard'),
  weeklySummaries: () => get<{ data: unknown[] }>('/analytics/weekly'),
  currentWeek: () => get<{ data: unknown }>('/analytics/weekly/current'),
  categories: (params?: { from?: string; to?: string }) =>
    get<{ data: unknown }>('/analytics/categories', params),
  merchants: (params?: { from?: string; to?: string }) =>
    get<{ data: unknown }>('/analytics/merchants', params),
  fixedVsFlexible: () => get<{ data: unknown }>('/analytics/fixed-vs-flexible'),
};

export interface DashboardResponse {
  currentWeek: {
    totalSpent: number;
    totalEarned: number;
    netFlow: number;
    transactionCount: number;
  };
  monthToDate: {
    totalSpent: number;
    totalEarned: number;
    netFlow: number;
    daysRemaining: number;
    dailyAverage: number;
  };
  fixedVsFlexible: {
    fixed: number;
    flexible: number;
    total: number;
  };
  topMerchants: Array<{ name: string; amount: number; count: number; logoUrl?: string | null }>;
  budgets: Array<{
    id: string;
    categoryId: string;
    limitAmount: number;
    spentAmount: number;
    percent: number;
  }>;
  insights: Array<{ id: string; type: string; title: string; body: string }>;
  upcomingBills: Array<{ name: string; amount: number; nextExpectedAt: string }>;
}

// ── Insights ────────────────────────────────────────────────────

export const insightsApi = {
  list: (cursor?: string) => get<{ data: unknown[]; nextCursor?: string }>('/insights', { cursor }),
  markRead: (id: string) => patch<void>(`/insights/${id}/read`, {}),
  markAllRead: () => post<void>('/insights/read-all'),
};

// ── Connections ─────────────────────────────────────────────────

export const connectionsApi = {
  list: () => get<{ data: unknown[] }>('/connections'),
  create: (institutionId: string) => post<{ data: { authUrl: string } }>('/connections', { institutionId }),
  delete: (id: string) => del(`/connections/${id}`),
};

// ── Institutions ────────────────────────────────────────────────

export const institutionsApi = {
  list: () => get<{ data: unknown[] }>('/institutions'),
};

// ── Notifications ───────────────────────────────────────────────

export const notificationsApi = {
  list: () => get<{ data: unknown[] }>('/notifications'),
  markRead: (id: string) => patch<void>(`/notifications/${id}/read`, {}),
};

// ── Sync ────────────────────────────────────────────────────────

export const syncApi = {
  trigger: () => post<{ data: unknown }>('/sync'),
  status: () => get<{ data: unknown }>('/sync/status'),
};

// ── Categories ──────────────────────────────────────────────────

export const categoriesApi = {
  list: () => get<{ data: unknown[] }>('/categories'),
};
