import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  ApiNonJsonResponseError,
  isBackendUnavailableError,
  isNativeMobilePlatform,
  markBackendApiUnavailable,
  parseStrictJsonResponse,
  resolveApiUrl,
} from '../utils/apiClient';
import { buildRedeemOverviewStats, redeemFirestoreService } from './RedeemFirestoreService';
import { adminFirestoreService } from './AdminFirestoreService';
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

function isNetworkOrHtmlError(err: unknown): boolean {
  if ((err as any)?.status === 404 || err instanceof ApiNonJsonResponseError) {
    markBackendApiUnavailable();
  }
  return isBackendUnavailableError(err);
}

async function handleApiResponse<T>(resp: Response): Promise<T> {
  return parseStrictJsonResponse<T>(resp);
}

async function withFirestoreFallback<T>(
  path: string,
  expressFn: (apiUrl: string) => Promise<T>,
  firestoreFallback: () => Promise<T>
): Promise<T> {
  const apiUrl = resolveApiUrl(path);
  if (apiUrl) {
    try {
      return await expressFn(apiUrl);
    } catch (err) {
      if (!isNetworkOrHtmlError(err)) {
        throw err;
      }
    }
  }
  return firestoreFallback();
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

function mergeRedeemCodeLists(
  expressCodes: RedeemCodeRecord[],
  firestoreCodes: RedeemCodeRecord[]
): RedeemCodeRecord[] {
  const byKey = new Map<string, RedeemCodeRecord>();
  const keyFor = (rec: RedeemCodeRecord) =>
    rec.codeHash || rec.id || rec.maskedCode || rec.code;

  for (const fc of firestoreCodes) {
    byKey.set(keyFor(fc), fc);
  }

  for (const ec of expressCodes) {
    const key =
      (ec.codeHash && byKey.has(ec.codeHash) ? ec.codeHash : null) ||
      (ec.id && byKey.has(ec.id) ? ec.id : null) ||
      keyFor(ec);
    const existing =
      byKey.get(key) ||
      Array.from(byKey.values()).find(
        (candidate) =>
          (ec.id && candidate.id === ec.id) ||
          (ec.codeHash && candidate.codeHash === ec.codeHash)
      );
    if (!existing) {
      byKey.set(key, ec);
    } else {
      const mergedHistoryMap = new Map<string, { uid: string; email?: string | null; usedAt: number }>();
      for (const h of [...(ec.usageHistory || []), ...(existing.usageHistory || [])]) {
        mergedHistoryMap.set(`${h.uid}_${h.usedAt}`, h);
      }
      const usageHistory = Array.from(mergedHistoryMap.values()).sort((a, b) => b.usedAt - a.usedAt);
      const usesCount = Math.max(ec.usesCount || 0, existing.usesCount || 0, usageHistory.length);
      const maxUses = ec.maxUses || existing.maxUses || 1;
      const mergedStatus =
        existing.status === 'revoked' || ec.status === 'revoked'
          ? 'revoked'
          : existing.status === 'disabled' || ec.status === 'disabled'
          ? 'disabled'
          : usesCount >= maxUses
          ? 'used'
          : existing.status || ec.status;
      byKey.set(keyFor(existing), {
        ...existing,
        ...ec,
        codeHash: existing.codeHash || ec.codeHash,
        usesCount,
        status: mergedStatus,
        usageHistory,
        usedByUid: usageHistory[0]?.uid ?? ec.usedByUid ?? existing.usedByUid ?? null,
        usedByEmail: usageHistory[0]?.email ?? ec.usedByEmail ?? existing.usedByEmail ?? null,
        usedAt: usageHistory[0]?.usedAt ?? ec.usedAt ?? existing.usedAt ?? null,
      });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export const superAdminService = {
  async logUnauthorizedRouteAttempt(): Promise<void> {
    try {
      const apiUrl = resolveApiUrl('/api/super-admin/audit-denied');
      if (apiUrl) {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { method: 'POST', headers });
        if (resp.ok) return;
      }
    } catch {
      // fall through to Firestore audit log
    }
    await adminFirestoreService.logUnauthorizedRouteAttempt().catch(() => {});
  },

  async getOverview(): Promise<SuperAdminOverviewResponse> {
    return withFirestoreFallback(
      '/api/super-admin/overview',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse<SuperAdminOverviewResponse>(resp);
      },
      () => adminFirestoreService.getSuperAdminOverview()
    );
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
    return withFirestoreFallback(
      `/api/super-admin/users?${qs.toString()}`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getUsers(params)
    );
  },

  async getUserDetails(uid: string): Promise<{
    user: AdminUserSummary;
    accessibilityRequests: AccessibilityRequestRecord[];
    supportTickets: SupportTicketRecord[];
    familyProfilesCount: number;
    auditLogs: AuditLogEntry[];
  }> {
    return withFirestoreFallback(
      `/api/super-admin/users/${encodeURIComponent(uid)}`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getUserDetails(uid)
    );
  },

  async suspendUser(uid: string, reason: string, durationHours: number): Promise<void> {
    await withFirestoreFallback(
      `/api/super-admin/users/${encodeURIComponent(uid)}/suspend`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason, durationHours }),
        });
        await handleApiResponse(resp);
      },
      () => adminFirestoreService.suspendUser(uid, reason, durationHours)
    );
  },

  async banUser(uid: string, reason: string, forceRefreshToken = false): Promise<void> {
    await withFirestoreFallback(
      `/api/super-admin/users/${encodeURIComponent(uid)}/ban`,
      async (apiUrl) => {
        const headers = await getAuthHeaders(forceRefreshToken);
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason }),
        });
        await handleApiResponse(resp);
      },
      () => adminFirestoreService.banUser(uid, reason)
    );
  },

  async unbanUser(uid: string, reason?: string): Promise<void> {
    await withFirestoreFallback(
      `/api/super-admin/users/${encodeURIComponent(uid)}/unban`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason }),
        });
        await handleApiResponse(resp);
      },
      () => adminFirestoreService.unbanUser(uid, reason)
    );
  },

  async revokeUserSessions(uid: string, reason?: string): Promise<void> {
    await withFirestoreFallback(
      `/api/super-admin/users/${encodeURIComponent(uid)}/revoke-sessions`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason }),
        });
        await handleApiResponse(resp);
      },
      () => adminFirestoreService.revokeUserSessions(uid, reason)
    );
  },

  async softDeleteUser(uid: string, reason: string): Promise<void> {
    await withFirestoreFallback(
      `/api/super-admin/users/${encodeURIComponent(uid)}/soft-delete`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason }),
        });
        await handleApiResponse(resp);
      },
      () => adminFirestoreService.softDeleteUser(uid, reason)
    );
  },

  async hardDeleteUser(
    uid: string,
    confirmPhrase: string,
    reason: string,
    forceRefreshToken = false
  ): Promise<void> {
    await withFirestoreFallback(
      `/api/super-admin/users/${encodeURIComponent(uid)}`,
      async (apiUrl) => {
        const headers = await getAuthHeaders(forceRefreshToken);
        const resp = await fetch(apiUrl, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ confirmPhrase, reason }),
        });
        await handleApiResponse(resp);
      },
      () => adminFirestoreService.hardDeleteUser(uid, confirmPhrase, reason)
    );
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
    return withFirestoreFallback(
      `/api/super-admin/users/${encodeURIComponent(uid)}/subscription`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.updateUserSubscription(uid, payload)
    );
  },

  async getRedeemCodes(): Promise<{ codes: RedeemCodeRecord[]; stats: AdminOverviewStats }> {
    const apiUrl = resolveApiUrl('/api/super-admin/redeem-codes');
    if (apiUrl) {
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        const expressData = await handleApiResponse<{
          codes: RedeemCodeRecord[];
          stats: AdminOverviewStats;
        }>(resp);

        const fsData = await redeemFirestoreService.listRedeemCodesFromFirestore().catch(() => null);
        if (!fsData) {
          return expressData;
        }

        const mergedCodes = mergeRedeemCodeLists(expressData.codes || [], fsData.codes || []);
        const codeStats = buildRedeemOverviewStats(mergedCodes, []);
        return {
          codes: mergedCodes,
          stats: {
            ...expressData.stats,
            totalCodes: codeStats.totalCodes,
            availableCodes: codeStats.availableCodes,
            usedCodes: codeStats.usedCodes,
            expiredCodes: codeStats.expiredCodes,
            revokedCodes: codeStats.revokedCodes,
            disabledCodes: codeStats.disabledCodes,
          },
        };
      } catch (err) {
        if (!isNetworkOrHtmlError(err)) {
          throw err;
        }
      }
    }
    const fsRes = await redeemFirestoreService.listRedeemCodesFromFirestore();
    return { codes: fsRes.codes, stats: fsRes.stats };
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
    const apiUrl = resolveApiUrl('/api/super-admin/redeem-codes');
    if (apiUrl) {
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const data = await handleApiResponse<{
          generatedCodes: RedeemCodeRecord[];
          maskedCodes: RedeemCodeRecord[];
          stats: AdminOverviewStats;
        }>(resp);
        await redeemFirestoreService.mirrorGeneratedCodesToFirestore(data.generatedCodes);
        const fsRes = await redeemFirestoreService.listRedeemCodesFromFirestore().catch(() => null);
        if (fsRes) {
          const mergedCodes = mergeRedeemCodeLists(data.maskedCodes || [], fsRes.codes || []);
          const codeStats = buildRedeemOverviewStats(mergedCodes, []);
          return {
            generatedCodes: data.generatedCodes,
            maskedCodes: mergedCodes,
            stats: {
              ...data.stats,
              totalCodes: codeStats.totalCodes,
              availableCodes: codeStats.availableCodes,
              usedCodes: codeStats.usedCodes,
              expiredCodes: codeStats.expiredCodes,
              revokedCodes: codeStats.revokedCodes,
              disabledCodes: codeStats.disabledCodes,
            },
          };
        }
        return data;
      } catch (err) {
        if (!isNetworkOrHtmlError(err)) {
          throw err;
        }
      }
    }
    return redeemFirestoreService.generateRedeemCodesInFirestore(payload);
  },

  async updateRedeemStatus(
    id: string,
    action: 'revoke' | 'disable' | 'enable'
  ): Promise<{ code: RedeemCodeRecord; stats: AdminOverviewStats }> {
    const apiUrl = resolveApiUrl(`/api/super-admin/redeem-codes/${encodeURIComponent(id)}/${action}`);
    if (apiUrl) {
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
        });
        const data = await handleApiResponse<{
          code: RedeemCodeRecord;
          stats: AdminOverviewStats;
        }>(resp);
        await redeemFirestoreService.mirrorRedeemStatusToFirestore(id, action);
        return data;
      } catch (err: any) {
        const errMsg = String(err?.message || '').toLowerCase();
        if (!isNetworkOrHtmlError(err) && !errMsg.includes('introuvable')) {
          throw err;
        }
      }
    }
    return redeemFirestoreService.updateRedeemCodeStatusInFirestore({
      idOrHash: id,
      action,
    });
  },

  async downloadRedeemCsv(): Promise<void> {
    const apiUrl = resolveApiUrl('/api/super-admin/redeem-codes/export-csv');
    if (apiUrl) {
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        const contentType = resp.headers.get('content-type') || '';
        if (resp.ok && !contentType.includes('text/html')) {
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vruguard-redeem-codes-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
        if (resp.status === 404 || contentType.includes('text/html')) {
          markBackendApiUnavailable();
        }
      } catch (err) {
        if (!isNetworkOrHtmlError(err)) {
          throw err;
        }
      }
    }
    const { codes } = await this.getRedeemCodes();
    redeemFirestoreService.triggerLocalCsvDownload(codes);
  },

  async getAccessibilityRequests(): Promise<{ requests: AccessibilityRequestRecord[] }> {
    return withFirestoreFallback(
      '/api/super-admin/accessibility',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        const data = await handleApiResponse<{ requests?: AccessibilityRequestRecord[] }>(resp);
        return { requests: Array.isArray(data?.requests) ? data.requests : [] };
      },
      () => adminFirestoreService.getAccessibilityRequests()
    );
  },

  async fetchAccessibilityDocumentBlob(requestId: string): Promise<{ blob: Blob; mimeType: string }> {
    return withFirestoreFallback(
      `/api/super-admin/accessibility/${encodeURIComponent(requestId)}/document`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        const ct = resp.headers.get('Content-Type') || '';
        if (resp.status === 404 || ct.includes('text/html')) {
          throw new ApiNonJsonResponseError('Document absent du serveur statique', resp.status, ct);
        }
        if (!resp.ok) throw new Error('Justificatif indisponible.');
        const blob = await resp.blob();
        return { blob, mimeType: ct || 'application/octet-stream' };
      },
      () => adminFirestoreService.fetchAccessibilityDocumentBlob(requestId)
    );
  },

  async reviewAccessibilityRequest(
    requestId: string,
    decision: 'approved' | 'rejected' | 'more_info_required',
    comment?: string
  ): Promise<{ request: AccessibilityRequestRecord; subscription?: UserSubscription }> {
    return withFirestoreFallback(
      `/api/super-admin/accessibility/${encodeURIComponent(requestId)}/decision`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ decision, comment }),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.reviewAccessibilityRequest(requestId, decision, comment)
    );
  },

  async getPioneerData(): Promise<{
    pioneers: AdminUserSummary[];
    whitelistedEmails: Array<{ email: string; startDate: number; endDate: number; note?: string }>;
  }> {
    return withFirestoreFallback(
      '/api/super-admin/pioneer',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getPioneerData()
    );
  },

  async grantPioneer(payload: {
    uid?: string;
    email?: string;
    durationDays?: number;
    note?: string;
  }): Promise<void> {
    await withFirestoreFallback(
      '/api/super-admin/pioneer/grant',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        await handleApiResponse(resp);
      },
      () => adminFirestoreService.grantPioneer(payload)
    );
  },

  async revokePioneer(payload: { uid?: string; email?: string; reason: string }): Promise<void> {
    await withFirestoreFallback(
      '/api/super-admin/pioneer/revoke',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        await handleApiResponse(resp);
      },
      () => adminFirestoreService.revokePioneer(payload)
    );
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
    return withFirestoreFallback(
      `/api/super-admin/audit-logs?${qs.toString()}`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getAuditLogs(params)
    );
  },

  async getSettings(): Promise<{
    settings: PlatformSettings;
    priceHistory?: PriceChangeHistoryEntry[];
  }> {
    return withFirestoreFallback(
      '/api/super-admin/settings',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getSettings()
    );
  },

  async updateSettings(
    updates: Partial<PlatformSettings> & { reason?: string },
    forceRefreshToken = false
  ): Promise<{
    settings: PlatformSettings;
    priceHistory?: PriceChangeHistoryEntry[];
  }> {
    return withFirestoreFallback(
      '/api/super-admin/settings',
      async (apiUrl) => {
        const headers = await getAuthHeaders(forceRefreshToken);
        const resp = await fetch(apiUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updates),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.updateSettings(updates)
    );
  },

  async getPricingManagement(): Promise<{
    planPrices: PlatformSettings['planPrices'];
    regionalPlans: Record<SubscriptionPlan, PlanRegionalConfig>;
    priceHistory: PriceChangeHistoryEntry[];
  }> {
    return withFirestoreFallback(
      '/api/super-admin/pricing',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getPricingManagement()
    );
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
    return withFirestoreFallback(
      '/api/super-admin/pricing',
      async (apiUrl) => {
        const headers = await getAuthHeaders(forceRefreshToken);
        const resp = await fetch(apiUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.updateRegionalPricing(payload)
    );
  },

  async getAdminNotifications(): Promise<{ notifications: AdminNotificationRecord[] }> {
    return withFirestoreFallback(
      '/api/super-admin/notifications',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getAdminNotifications()
    );
  },

  async sendAdminNotification(payload: {
    title: string;
    message: string;
    type: AdminNotificationRecord['type'];
    targetScope: AdminNotificationRecord['targetScope'];
    targetUid?: string | null;
    targetEmail?: string | null;
  }): Promise<{ notification: AdminNotificationRecord }> {
    return withFirestoreFallback(
      '/api/super-admin/notifications',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.sendAdminNotification(payload)
    );
  },

  async getSupportOverview(): Promise<{
    tickets: SupportTicketRecord[];
    businessQuotes: BusinessQuoteRequest[];
    feedbacks: any[];
    incidentsCount: number;
    incidents: any[];
  }> {
    return withFirestoreFallback(
      '/api/super-admin/support',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getSupportOverview()
    );
  },

  async replySupportTicket(id: string, message: string): Promise<{ ticket: SupportTicketRecord }> {
    return withFirestoreFallback(
      `/api/super-admin/support/${encodeURIComponent(id)}/reply`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message }),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.replySupportTicket(id, message)
    );
  },

  async updateSupportTicketStatus(
    id: string,
    status: SupportTicketStatus,
    priority?: SupportTicketRecord['priority']
  ): Promise<{ ticket: SupportTicketRecord }> {
    return withFirestoreFallback(
      `/api/super-admin/support/${encodeURIComponent(id)}`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status, priority }),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.updateSupportTicketStatus(id, status, priority)
    );
  },

  async addSupportNote(id: string, note: string): Promise<{ ticket: SupportTicketRecord }> {
    return withFirestoreFallback(
      `/api/super-admin/support/${encodeURIComponent(id)}/notes`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ note }),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.addSupportNote(id, note)
    );
  },

  async updateBusinessQuote(
    id: string,
    payload: { status?: BusinessQuoteRequest['status']; internalNote?: string }
  ): Promise<{ quote: BusinessQuoteRequest }> {
    return withFirestoreFallback(
      `/api/super-admin/business-quotes/${encodeURIComponent(id)}`,
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.updateBusinessQuote(id, payload)
    );
  },

  async getSecurityOverview(): Promise<{
    securitySettings: PlatformSettings['securitySettings'];
    recentSecurityEvents: AuditLogEntry[];
    hasAdminIam: boolean;
    currentAdmin: { uid: string; email: string | null; role: string; authTimeMs: number };
  }> {
    return withFirestoreFallback(
      '/api/super-admin/security',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        return handleApiResponse(resp);
      },
      () => adminFirestoreService.getSecurityOverview()
    );
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
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Veuillez vous connecter pour déposer un dossier Accessibilité.');
    }

    const fullName = String(payload.fullName || '').trim().slice(0, 120);
    const disabilityCategory = String(payload.disabilityCategory || '').trim().slice(0, 120);
    const description = String(payload.description || '').trim().slice(0, 2000);
    if (!fullName || !disabilityCategory || !description) {
      throw new Error('Nom complet, situation et description requis.');
    }

    const apiUrl = resolveApiUrl('/api/accessibility/apply');
    if (apiUrl !== null) {
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...payload,
            fullName,
            disabilityCategory,
            description,
          }),
        });
        const data = await handleApiResponse<{ request?: AccessibilityRequestRecord }>(resp);
        if (!data?.request || typeof data.request !== 'object' || !data.request.id) {
          throw new Error('Réponse serveur incomplète lors de la soumission du dossier.');
        }
        return { request: data.request };
      } catch (err) {
        const canFallbackToFirestore = isNativeMobilePlatform() || isNetworkOrHtmlError(err);
        if (!canFallbackToFirestore) {
          throw err;
        }
      }
    }

    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const id = `acc_${now}_${rand}`;
    const docName = String(payload.documentName || 'justificatif').trim().slice(0, 255) || 'justificatif';
    const docMime =
      String(payload.documentMimeType || 'application/pdf').trim().slice(0, 120) || 'application/pdf';

    let documentDataUrl: string | null = null;
    let documentSize = 0;
    if (payload.documentBase64 && typeof payload.documentBase64 === 'string') {
      const cleanBase64 = payload.documentBase64.replace(/^data:[^;]+;base64,/, '');
      documentSize = Math.floor((cleanBase64.length * 3) / 4);
      const dataUrl = payload.documentBase64.startsWith('data:')
        ? payload.documentBase64
        : `data:${docMime};base64,${cleanBase64}`;
      if (dataUrl.length > 740000) {
        throw new Error(
          'En mode autonome, la taille du justificatif ne doit pas dépasser 500 Ko (utilisez une image compressée ou un PDF léger).'
        );
      }
      documentDataUrl = dataUrl;
    }

    const firestoreDoc = {
      id,
      uid: currentUser.uid,
      email: currentUser.email || null,
      displayName: currentUser.displayName ? currentUser.displayName.slice(0, 120) : null,
      fullName,
      disabilityCategory,
      description,
      documentName: docName,
      documentMimeType: docMime,
      documentSize,
      hasDocumentFile: Boolean(documentDataUrl),
      documentDataUrl,
      status: 'pending' as const,
      adminComment: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          action: 'SUBMITTED',
          actor: currentUser.email || currentUser.uid,
          comment: 'Demande soumise depuis l’application',
          timestamp: now,
        },
      ],
    };

    await setDoc(doc(db, 'accessibility_requests', id), firestoreDoc);
    const { documentDataUrl: _omit, ...safeRecord } = firestoreDoc;
    return { request: safeRecord };
  },

  async getMyAccessibilityApplications(): Promise<{ requests: AccessibilityRequestRecord[] }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { requests: [] };
    }

    const apiUrl = resolveApiUrl('/api/accessibility/me');
    if (apiUrl !== null) {
      try {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        const data = await handleApiResponse<{ requests?: AccessibilityRequestRecord[] }>(resp);
        if (!Array.isArray(data?.requests)) {
          throw new ApiNonJsonResponseError(
            'Structure de réponse invalide reçue du serveur.',
            resp.status,
            resp.headers.get('content-type') || ''
          );
        }
        return { requests: data.requests.filter(Boolean) };
      } catch (err) {
        const canFallbackToFirestore = isNativeMobilePlatform() || isNetworkOrHtmlError(err);
        if (!canFallbackToFirestore) {
          throw err;
        }
      }
    }

    const q = query(collection(db, 'accessibility_requests'), where('uid', '==', currentUser.uid));
    const snap = await getDocs(q);
    const requests: AccessibilityRequestRecord[] = snap.docs
      .map((d) => {
        const raw = d.data() as Record<string, any>;
        const { documentDataUrl: _omit, ...rest } = raw;
        return {
          ...(rest as AccessibilityRequestRecord),
          id: rest.id || d.id,
          history: Array.isArray(rest.history) ? rest.history : [],
        };
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { requests };
  },

  async submitSupportTicket(payload: {
    email: string;
    name: string;
    subject: string;
    category: SupportTicketRecord['category'];
    priority?: SupportTicketRecord['priority'];
    message: string;
  }): Promise<{ ticket: SupportTicketRecord }> {
    return withFirestoreFallback(
      '/api/support/tickets',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const data = await handleApiResponse<{ ticket?: SupportTicketRecord }>(resp);
        if (!data?.ticket || typeof data.ticket !== 'object' || !data.ticket.id) {
          throw new Error('Réponse serveur incomplète lors de la création du ticket.');
        }
        return { ticket: data.ticket };
      },
      () => adminFirestoreService.submitSupportTicket(payload)
    );
  },

  async getMySupportTickets(): Promise<{ tickets: SupportTicketRecord[] }> {
    return withFirestoreFallback(
      '/api/support/my-tickets',
      async (apiUrl) => {
        const headers = await getAuthHeaders();
        const resp = await fetch(apiUrl, { headers });
        const data = await handleApiResponse<{ tickets?: SupportTicketRecord[] }>(resp);
        return { tickets: Array.isArray(data?.tickets) ? data.tickets.filter(Boolean) : [] };
      },
      () => adminFirestoreService.getMySupportTickets()
    );
  },
};
