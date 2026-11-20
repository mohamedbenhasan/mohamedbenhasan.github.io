import { auth } from '../firebase';
import {
  AccessibilityRequestRecord,
  ActivationRecord,
  ActivationSource,
  AdminNotificationRecord,
  AdminOverviewStats,
  AdminUserSummary,
  AuditLogEntry,
  BillingCycle,
  BusinessQuoteRequest,
  PlatformSettings,
  PlanRegionalConfig,
  PresenceRecord,
  PriceChangeHistoryEntry,
  RedeemCodeRecord,
  RedeemDurationCode,
  SubscriptionPlan,
  SupportTicketRecord,
  SupportTicketStatus,
  UserSubscription,
} from '../types';

async function getAuthHeaders(forceRefreshToken = false): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    return { 'Content-Type': 'application/json' };
  }
  const token = await user.getIdToken(forceRefreshToken);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleApiResponse<T>(resp: Response): Promise<T> {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = Object.assign(new Error(data.error || `Erreur serveur (${resp.status})`), {
      status: resp.status,
      code: data.code,
    });
    throw err;
  }
  return data as T;
}

export interface SuperAdminOverviewResponse {
  kpis: {
    totalUsers: number;
    activeUsers: number;
    newToday: number;
    newThisWeek: number;
    bannedUsers: number;
    suspendedUsers: number;
    deletedUsers: number;
    onlineUsers: number;
    idleUsers: number;
    offlineUsers: number;
    freeUsers: number;
    premiumUsers: number;
    familyUsers: number;
    businessUsers: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    suspendedSubscriptions: number;
    lifetimeSubscriptions: number;
    pioneerUsers: number;
    totalCodes: number;
    availableCodes: number;
    usedCodes: number;
    expiredCodes: number;
    revokedCodes: number;
    disabledCodes: number;
    pendingAccessibility: number;
    openSupportTickets: number;
    newBusinessQuotes: number;
  };
  dailySeries: Array<{
    date: string;
    signups: number;
    activations: number;
    redeemActivations: number;
  }>;
  planDistribution: Array<{ name: string; value: number; color: string }>;
  recentAuditLogs: AuditLogEntry[];
  recentActivations: ActivationRecord[];
  serverCapabilities: { hasAdminIam: boolean };
}

export const superAdminService = {
  async logUnauthorizedRouteAttempt(): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      await fetch('/api/super-admin/audit-denied', { method: 'POST', headers });
    } catch {
      // silent
    }
  },

  async getOverview(): Promise<SuperAdminOverviewResponse> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/overview', { headers });
    return handleApiResponse(resp);
  },

  async getUsers(params?: {
    search?: string;
    plan?: string;
    accountStatus?: string;
    presence?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<{
    users: AdminUserSummary[];
    total: number;
    page: number;
    pageSize: number;
    presenceSummary: {
      onlineCount: number;
      idleCount: number;
      offlineCount: number;
      records: PresenceRecord[];
    };
  }> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.plan) qs.set('plan', params.plan);
    if (params?.accountStatus) qs.set('accountStatus', params.accountStatus);
    if (params?.presence) qs.set('presence', params.presence);
    if (params?.sortBy) qs.set('sortBy', params.sortBy);
    if (params?.sortDir) qs.set('sortDir', params.sortDir);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/users?${qs.toString()}`, { headers });
    return handleApiResponse(resp);
  },

  async getUserDetails(uid: string): Promise<{
    user: AdminUserSummary;
    accessibilityRequests: AccessibilityRequestRecord[];
    supportTickets: SupportTicketRecord[];
    familyProfilesCount: number;
    auditLogs: AuditLogEntry[];
  }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}`, { headers });
    return handleApiResponse(resp);
  },

  async suspendUser(uid: string, reason: string, durationHours: number): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/suspend`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason, durationHours }),
    });
    await handleApiResponse(resp);
  },

  async banUser(uid: string, reason: string, forceRefreshToken = false): Promise<void> {
    const headers = await getAuthHeaders(forceRefreshToken);
    const resp = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/ban`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
    await handleApiResponse(resp);
  },

  async unbanUser(uid: string, reason?: string): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/unban`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
    await handleApiResponse(resp);
  },

  async revokeUserSessions(uid: string, reason?: string): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/revoke-sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
    await handleApiResponse(resp);
  },

  async softDeleteUser(uid: string, reason: string): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/soft-delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
    await handleApiResponse(resp);
  },

  async hardDeleteUser(
    uid: string,
    confirmPhrase: string,
    reason: string,
    forceRefreshToken = false
  ): Promise<void> {
    const headers = await getAuthHeaders(forceRefreshToken);
    const resp = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ confirmPhrase, reason }),
    });
    await handleApiResponse(resp);
  },

  async updateUserSubscription(
    uid: string,
    payload: {
      action: 'assign' | 'extend' | 'suspend' | 'reactivate' | 'grant_lifetime' | 'downgrade_free';
      plan?: SubscriptionPlan;
      billingCycle?: BillingCycle;
      durationDays?: number | null;
      startDate?: number;
      endDate?: number | null;
      isLifetime?: boolean;
      reason: string;
      activationType?: ActivationSource;
      targetEmail?: string | null;
    }
  ): Promise<{ subscription: UserSubscription }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/subscription`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async getRedeemCodes(): Promise<{ codes: RedeemCodeRecord[]; stats: AdminOverviewStats }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/redeem-codes', { headers });
    return handleApiResponse(resp);
  },

  async generateRedeemCodes(payload: {
    plan: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
    durationCode: RedeemDurationCode;
    count: number;
    maxUses: number;
    expiresAt?: number | null;
    campaign?: string;
    note?: string;
  }): Promise<{
    generatedCodes: RedeemCodeRecord[];
    maskedCodes: RedeemCodeRecord[];
    stats: AdminOverviewStats;
  }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/redeem-codes', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async updateRedeemStatus(
    id: string,
    action: 'revoke' | 'disable' | 'enable'
  ): Promise<{ code: RedeemCodeRecord; stats: AdminOverviewStats }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/redeem-codes/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      headers,
    });
    return handleApiResponse(resp);
  },

  async downloadRedeemCsv(): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/redeem-codes/export-csv', { headers });
    if (!resp.ok) throw new Error('Export CSV impossible.');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vruguard-redeem-codes-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async getAccessibilityRequests(): Promise<{ requests: AccessibilityRequestRecord[] }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/accessibility', { headers });
    return handleApiResponse(resp);
  },

  async fetchAccessibilityDocumentBlob(requestId: string): Promise<{ blob: Blob; mimeType: string }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/accessibility/${encodeURIComponent(requestId)}/document`, {
      headers,
    });
    if (!resp.ok) throw new Error('Justificatif indisponible.');
    const blob = await resp.blob();
    return { blob, mimeType: resp.headers.get('Content-Type') || 'application/octet-stream' };
  },

  async reviewAccessibilityRequest(
    requestId: string,
    decision: 'approved' | 'rejected' | 'more_info_required',
    comment?: string
  ): Promise<{ request: AccessibilityRequestRecord; subscription?: UserSubscription }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(
      `/api/super-admin/accessibility/${encodeURIComponent(requestId)}/decision`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision, comment }),
      }
    );
    return handleApiResponse(resp);
  },

  async getPioneerData(): Promise<{
    pioneers: AdminUserSummary[];
    whitelistedEmails: Array<{ email: string; startDate: number; endDate: number; note?: string }>;
  }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/pioneer', { headers });
    return handleApiResponse(resp);
  },

  async grantPioneer(payload: {
    uid?: string;
    email?: string;
    durationDays?: number;
    note?: string;
  }): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/pioneer/grant', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    await handleApiResponse(resp);
  },

  async revokePioneer(payload: { uid?: string; email?: string; reason: string }): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/pioneer/revoke', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    await handleApiResponse(resp);
  },

  async getAuditLogs(params?: {
    category?: string;
    outcome?: string;
    search?: string;
    limit?: number;
  }): Promise<{ logs: AuditLogEntry[] }> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.outcome) qs.set('outcome', params.outcome);
    if (params?.search) qs.set('search', params.search);
    if (params?.limit) qs.set('limit', String(params.limit));
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/audit-logs?${qs.toString()}`, { headers });
    return handleApiResponse(resp);
  },

  async getSettings(): Promise<{
    settings: PlatformSettings;
    priceHistory?: PriceChangeHistoryEntry[];
  }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/settings', { headers });
    return handleApiResponse(resp);
  },

  async updateSettings(
    updates: Partial<PlatformSettings> & { reason?: string },
    forceRefreshToken = false
  ): Promise<{
    settings: PlatformSettings;
    priceHistory?: PriceChangeHistoryEntry[];
  }> {
    const headers = await getAuthHeaders(forceRefreshToken);
    const resp = await fetch('/api/super-admin/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return handleApiResponse(resp);
  },

  async getPricingManagement(): Promise<{
    planPrices: PlatformSettings['planPrices'];
    regionalPlans: Record<SubscriptionPlan, PlanRegionalConfig>;
    priceHistory: PriceChangeHistoryEntry[];
  }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/pricing', { headers });
    return handleApiResponse(resp);
  },

  async updateRegionalPricing(
    payload: {
      planPrices?: Partial<PlatformSettings['planPrices']>;
      regionalPlans?: Record<SubscriptionPlan, PlanRegionalConfig>;
      reason?: string;
    },
    forceRefreshToken = false
  ): Promise<{
    settings: PlatformSettings;
    planPrices: PlatformSettings['planPrices'];
    regionalPlans: Record<SubscriptionPlan, PlanRegionalConfig>;
    priceHistory: PriceChangeHistoryEntry[];
  }> {
    const headers = await getAuthHeaders(forceRefreshToken);
    const resp = await fetch('/api/super-admin/pricing', {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async getAdminNotifications(): Promise<{ notifications: AdminNotificationRecord[] }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/notifications', { headers });
    return handleApiResponse(resp);
  },

  async sendAdminNotification(payload: {
    title: string;
    message: string;
    type: AdminNotificationRecord['type'];
    targetScope: AdminNotificationRecord['targetScope'];
    targetUid?: string | null;
    targetEmail?: string | null;
  }): Promise<{ notification: AdminNotificationRecord }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/notifications', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async getSupportOverview(): Promise<{
    tickets: SupportTicketRecord[];
    businessQuotes: BusinessQuoteRequest[];
    feedbacks: any[];
    incidentsCount: number;
    incidents: any[];
  }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/support', { headers });
    return handleApiResponse(resp);
  },

  async replySupportTicket(id: string, message: string): Promise<{ ticket: SupportTicketRecord }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/support/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
    });
    return handleApiResponse(resp);
  },

  async updateSupportTicketStatus(
    id: string,
    status: SupportTicketStatus,
    priority?: SupportTicketRecord['priority']
  ): Promise<{ ticket: SupportTicketRecord }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/support/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, priority }),
    });
    return handleApiResponse(resp);
  },

  async addSupportNote(id: string, note: string): Promise<{ ticket: SupportTicketRecord }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/support/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ note }),
    });
    return handleApiResponse(resp);
  },

  async updateBusinessQuote(
    id: string,
    payload: { status?: BusinessQuoteRequest['status']; internalNote?: string }
  ): Promise<{ quote: BusinessQuoteRequest }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(`/api/super-admin/business-quotes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async getSecurityOverview(): Promise<{
    securitySettings: PlatformSettings['securitySettings'];
    recentSecurityEvents: AuditLogEntry[];
    hasAdminIam: boolean;
    currentAdmin: { uid: string; email: string | null; role: string; authTimeMs: number };
  }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/super-admin/security', { headers });
    return handleApiResponse(resp);
  },

  // --- User-facing Accessibility, Support & Notification helpers ---

  async submitAccessibilityApplication(payload: {
    fullName: string;
    disabilityCategory: string;
    description: string;
    documentName: string;
    documentMimeType: string;
    documentBase64?: string;
  }): Promise<{ request: AccessibilityRequestRecord }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/accessibility/apply', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async getMyAccessibilityApplications(): Promise<{ requests: AccessibilityRequestRecord[] }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/accessibility/me', { headers });
    return handleApiResponse(resp);
  },

  async submitSupportTicket(payload: {
    email: string;
    name: string;
    subject: string;
    category: SupportTicketRecord['category'];
    priority?: SupportTicketRecord['priority'];
    message: string;
  }): Promise<{ ticket: SupportTicketRecord }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/support/tickets', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async getMySupportTickets(): Promise<{ tickets: SupportTicketRecord[] }> {
    const headers = await getAuthHeaders();
    const resp = await fetch('/api/support/my-tickets', { headers });
    return handleApiResponse(resp);
  },
};
