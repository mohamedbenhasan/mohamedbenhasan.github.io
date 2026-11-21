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

function requireApiUrl(path: string): string {
  const url = resolveApiUrl(path);
  if (!url) {
    throw new Error(
      'Connexion au serveur VruGuard requise pour cette opération (URL API non configurée).'
    );
  }
  return url;
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
      const apiUrl = resolveApiUrl('/api/super-admin/audit-denied');
      if (!apiUrl) return;
      const headers = await getAuthHeaders();
      await fetch(apiUrl, { method: 'POST', headers });
    } catch {
      // silent
    }
  },

  async getOverview(): Promise<SuperAdminOverviewResponse> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl('/api/super-admin/overview'), { headers });
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
    const resp = await fetch(requireApiUrl(`/api/super-admin/users?${qs.toString()}`), { headers });
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
    const resp = await fetch(requireApiUrl(`/api/super-admin/users/${encodeURIComponent(uid)}`), { headers });
    return handleApiResponse(resp);
  },

  async suspendUser(uid: string, reason: string, durationHours: number): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl(`/api/super-admin/users/${encodeURIComponent(uid)}/suspend`), {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason, durationHours }),
    });
    await handleApiResponse(resp);
  },

  async banUser(uid: string, reason: string, forceRefreshToken = false): Promise<void> {
    const headers = await getAuthHeaders(forceRefreshToken);
    const resp = await fetch(requireApiUrl(`/api/super-admin/users/${encodeURIComponent(uid)}/ban`), {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
    await handleApiResponse(resp);
  },

  async unbanUser(uid: string, reason?: string): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl(`/api/super-admin/users/${encodeURIComponent(uid)}/unban`), {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
    await handleApiResponse(resp);
  },

  async revokeUserSessions(uid: string, reason?: string): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl(`/api/super-admin/users/${encodeURIComponent(uid)}/revoke-sessions`), {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
    await handleApiResponse(resp);
  },

  async softDeleteUser(uid: string, reason: string): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl(`/api/super-admin/users/${encodeURIComponent(uid)}/soft-delete`), {
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
    const resp = await fetch(requireApiUrl(`/api/super-admin/users/${encodeURIComponent(uid)}`), {
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
    const resp = await fetch(requireApiUrl(`/api/super-admin/users/${encodeURIComponent(uid)}/subscription`), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async getRedeemCodes(): Promise<{ codes: RedeemCodeRecord[]; stats: AdminOverviewStats }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl('/api/super-admin/redeem-codes'), { headers });
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
    const resp = await fetch(requireApiUrl('/api/super-admin/redeem-codes'), {
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
    const resp = await fetch(requireApiUrl(`/api/super-admin/redeem-codes/${encodeURIComponent(id)}/${action}`), {
      method: 'POST',
      headers,
    });
    return handleApiResponse(resp);
  },

  async downloadRedeemCsv(): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl('/api/super-admin/redeem-codes/export-csv'), { headers });
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
    const resp = await fetch(requireApiUrl('/api/super-admin/accessibility'), { headers });
    const data = await handleApiResponse<{ requests?: AccessibilityRequestRecord[] }>(resp);
    return { requests: Array.isArray(data?.requests) ? data.requests : [] };
  },

  async fetchAccessibilityDocumentBlob(requestId: string): Promise<{ blob: Blob; mimeType: string }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(
      requireApiUrl(`/api/super-admin/accessibility/${encodeURIComponent(requestId)}/document`),
      { headers }
    );
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
      requireApiUrl(`/api/super-admin/accessibility/${encodeURIComponent(requestId)}/decision`),
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
    const resp = await fetch(requireApiUrl('/api/super-admin/pioneer'), { headers });
    return handleApiResponse(resp);
  },

  async grantPioneer(payload: {
    uid?: string;
    email?: string;
    durationDays?: number;
    note?: string;
  }): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl('/api/super-admin/pioneer/grant'), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    await handleApiResponse(resp);
  },

  async revokePioneer(payload: { uid?: string; email?: string; reason: string }): Promise<void> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl('/api/super-admin/pioneer/revoke'), {
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
    const resp = await fetch(requireApiUrl(`/api/super-admin/audit-logs?${qs.toString()}`), { headers });
    return handleApiResponse(resp);
  },

  async getSettings(): Promise<{
    settings: PlatformSettings;
    priceHistory?: PriceChangeHistoryEntry[];
  }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl('/api/super-admin/settings'), { headers });
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
    const resp = await fetch(requireApiUrl('/api/super-admin/settings'), {
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
    const resp = await fetch(requireApiUrl('/api/super-admin/pricing'), { headers });
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
    const resp = await fetch(requireApiUrl('/api/super-admin/pricing'), {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    return handleApiResponse(resp);
  },

  async getAdminNotifications(): Promise<{ notifications: AdminNotificationRecord[] }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl('/api/super-admin/notifications'), { headers });
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
    const resp = await fetch(requireApiUrl('/api/super-admin/notifications'), {
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
    const resp = await fetch(requireApiUrl('/api/super-admin/support'), { headers });
    return handleApiResponse(resp);
  },

  async replySupportTicket(id: string, message: string): Promise<{ ticket: SupportTicketRecord }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl(`/api/super-admin/support/${encodeURIComponent(id)}/reply`), {
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
    const resp = await fetch(requireApiUrl(`/api/super-admin/support/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, priority }),
    });
    return handleApiResponse(resp);
  },

  async addSupportNote(id: string, note: string): Promise<{ ticket: SupportTicketRecord }> {
    const headers = await getAuthHeaders();
    const resp = await fetch(requireApiUrl(`/api/super-admin/support/${encodeURIComponent(id)}/notes`), {
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
    const resp = await fetch(requireApiUrl(`/api/super-admin/business-quotes/${encodeURIComponent(id)}`), {
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
    const resp = await fetch(requireApiUrl('/api/super-admin/security'), { headers });
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

    // Standalone mobile APK / Firestore fallback: persist strictly validated dossier directly in Firestore
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
          'En mode mobile autonome, la taille du justificatif ne doit pas dépasser 500 Ko (utilisez une image compressée ou un PDF léger).'
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
          comment: 'Demande soumise depuis l’application mobile',
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

    // Standalone mobile APK / offline fallback: load the user's dossiers from Firestore
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
    const apiUrl = requireApiUrl('/api/support/tickets');
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

  async getMySupportTickets(): Promise<{ tickets: SupportTicketRecord[] }> {
    const apiUrl = resolveApiUrl('/api/support/my-tickets');
    if (apiUrl === null) {
      return { tickets: [] };
    }
    const headers = await getAuthHeaders();
    const resp = await fetch(apiUrl, { headers });
    const data = await handleApiResponse<{ tickets?: SupportTicketRecord[] }>(resp);
    return { tickets: Array.isArray(data?.tickets) ? data.tickets.filter(Boolean) : [] };
  },
};
