import { auth } from '../firebase';
import { parseStrictJsonResponse, resolveApiUrl } from '../utils/apiClient';
import {
  ActivationRecord,
  AdminOverviewStats,
  BillingCycle,
  BusinessQuoteRequest,
  FamilyMemberProfile,
  FeatureKey,
  RedeemCodeRecord,
  SubscriptionPlan,
  SupportedCurrency,
  UserSubscription,
  VRUType,
} from '../types';
import {
  getEntitlementsForPlan,
  getRequiredPlanForFeature,
  hasFeatureAccess,
} from '../utils/subscriptionPlans';

export class SubscriptionRequiredError extends Error {
  public readonly feature: FeatureKey;
  public readonly requiredPlan: SubscriptionPlan;
  public readonly code: string;

  constructor(
    feature: FeatureKey,
    requiredPlan: SubscriptionPlan = getRequiredPlanForFeature(feature),
    code: string = requiredPlan === 'FAMILY' ? 'FAMILY_REQUIRED' : 'PREMIUM_REQUIRED',
    message?: string
  ) {
    super(
      message ||
        `Cette fonctionnalité est disponible avec VruGuard ${requiredPlan === 'FAMILY' ? 'Family' : requiredPlan === 'BUSINESS' ? 'Business' : 'Premium'}.`
    );
    this.name = 'SubscriptionRequiredError';
    this.feature = feature;
    this.requiredPlan = requiredPlan;
    this.code = code;
  }
}

export interface GatewayStatus {
  stripe: boolean;
  konnect: boolean;
}

type SubscriptionListener = (sub: UserSubscription | null) => void;
type UpgradeModalListener = (feature: FeatureKey) => void;

class SubscriptionService {
  private currentSubscription: UserSubscription | null = null;
  private gatewaysConfigured: GatewayStatus = { stripe: false, konnect: false };
  private listeners = new Set<SubscriptionListener>();
  private upgradeListeners = new Set<UpgradeModalListener>();

  public subscribe(listener: SubscriptionListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSubscription);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onUpgradeRequired(listener: UpgradeModalListener): () => void {
    this.upgradeListeners.add(listener);
    return () => {
      this.upgradeListeners.delete(listener);
    };
  }

  public triggerUpgradeModal(feature: FeatureKey): void {
    this.upgradeListeners.forEach((l) => l(feature));
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.currentSubscription));
  }

  public getCurrentSubscription(): UserSubscription | null {
    return this.currentSubscription;
  }

  public getGatewaysConfigured(): GatewayStatus {
    return this.gatewaysConfigured;
  }

  public clear(): void {
    this.currentSubscription = null;
    this.notify();
  }

  public async getAuthHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser;
    if (!user) {
      return { 'Content-Type': 'application/json' };
    }
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  public buildFallbackFreeSubscription(uid: string): UserSubscription {
    return {
      uid,
      plan: 'FREE',
      effectivePlan: 'FREE',
      status: 'active',
      billingCycle: 'monthly',
      startDate: Date.now(),
      endDate: null,
      cancelAtPeriodEnd: false,
      isEarlyTester: false,
      earlyTesterStartDate: null,
      earlyTesterEndDate: null,
      earlyTesterBadge: null,
      paymentProvider: null,
      paymentVerified: false,
      lastPaymentRef: null,
      updatedAt: Date.now(),
      entitlements: getEntitlementsForPlan('FREE'),
      transactions: [],
    };
  }

  public async fetchMySubscription(): Promise<UserSubscription | null> {
    const user = auth.currentUser;
    if (!user) {
      this.clear();
      return null;
    }

    try {
      const apiUrl = resolveApiUrl('/api/subscriptions/me');
      if (!apiUrl) {
        this.currentSubscription = this.buildFallbackFreeSubscription(user.uid);
        this.notify();
        return this.currentSubscription;
      }
      const headers = await this.getAuthHeaders();
      const resp = await fetch(apiUrl, { headers });
      const data = await parseStrictJsonResponse<any>(resp);
      if (!data?.subscription || typeof data.subscription !== 'object') {
        throw new Error('Invalid subscription payload');
      }
      this.currentSubscription = data.subscription as UserSubscription;
      if (data.paymentGatewaysConfigured) {
        this.gatewaysConfigured = data.paymentGatewaysConfigured;
      }
      this.notify();
      return this.currentSubscription;
    } catch (err) {
      console.warn('Subscription fetch failed, defaulting safely to FREE:', err);
      this.currentSubscription = this.buildFallbackFreeSubscription(user.uid);
      this.notify();
      return this.currentSubscription;
    }
  }

  public hasFeature(feature: FeatureKey): boolean {
    if (!this.currentSubscription) return false;
    // Check expiration dynamically in client as well
    if (
      this.currentSubscription.effectivePlan !== 'FREE' &&
      this.currentSubscription.endDate &&
      this.currentSubscription.endDate <= Date.now() &&
      !(
        this.currentSubscription.isEarlyTester &&
        this.currentSubscription.earlyTesterEndDate &&
        this.currentSubscription.earlyTesterEndDate > Date.now()
      )
    ) {
      return false;
    }
    return hasFeatureAccess(this.currentSubscription, feature);
  }

  public ensureFeature(feature: FeatureKey, openModalOnDeny = true): void {
    if (!this.hasFeature(feature)) {
      if (openModalOnDeny) {
        this.triggerUpgradeModal(feature);
      }
      throw new SubscriptionRequiredError(feature);
    }
  }

  private requireApiUrl(path: string): string {
    const apiUrl = resolveApiUrl(path);
    if (!apiUrl) {
      throw new Error(
        'Connexion au serveur VruGuard requise pour cette opération (URL API non configurée).'
      );
    }
    return apiUrl;
  }

  public async authorizeServerAction(endpoint: string, feature: FeatureKey): Promise<void> {
    this.ensureFeature(feature, true);
    const apiUrl = this.requireApiUrl(endpoint);
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, { method: 'POST', headers });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      if (resp.status === 403) {
        this.triggerUpgradeModal(feature);
        throw new SubscriptionRequiredError(
          feature,
          body.requiredPlan || getRequiredPlanForFeature(feature),
          body.code || 'PREMIUM_REQUIRED',
          body.error
        );
      }
      throw new Error(body.error || 'Autorisation serveur refusée.');
    }
  }

  public async createCheckoutSession(params: {
    plan: 'PREMIUM' | 'FAMILY';
    billingCycle: 'monthly' | 'annual';
    provider?: 'stripe' | 'konnect';
    country?: string | null;
    currency?: SupportedCurrency;
  }): Promise<{
    checkoutUrl: string;
    sessionId: string;
    provider: string;
    amount?: number;
    currency?: SupportedCurrency;
    country?: string | null;
  }> {
    const apiUrl = this.requireApiUrl('/api/subscriptions/checkout');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const rawText = await resp.text();
    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error('Réponse invalide du serveur de paiement.');
    }
    if (!resp.ok) {
      throw Object.assign(new Error(data.error || 'Impossible de lancer le paiement.'), {
        code: data.code,
        status: resp.status,
        allowedProviders: data.allowedProviders,
        quote: data.quote,
      });
    }
    return data;
  }

  public async verifyPayment(params: {
    provider: 'stripe' | 'konnect';
    sessionId?: string;
    paymentRef?: string;
  }): Promise<UserSubscription> {
    const apiUrl = this.requireApiUrl('/api/subscriptions/verify-payment');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await parseStrictJsonResponse<{ subscription?: UserSubscription }>(resp);
    if (!data?.subscription || typeof data.subscription.plan !== 'string') {
      throw new Error('Réponse de vérification du paiement incomplète.');
    }
    this.currentSubscription = data.subscription;
    this.notify();
    return data.subscription;
  }

  public async cancelSubscription(): Promise<UserSubscription> {
    const apiUrl = this.requireApiUrl('/api/subscriptions/cancel');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
    });
    const data = await parseStrictJsonResponse<{ subscription?: UserSubscription }>(resp);
    if (!data?.subscription || typeof data.subscription.plan !== 'string') {
      throw new Error('Réponse serveur invalide lors de l’annulation.');
    }
    this.currentSubscription = data.subscription;
    this.notify();
    return data.subscription;
  }

  public async redeemCode(params: {
    code: string;
    expectedPlan?: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
  }): Promise<{
    subscription: UserSubscription;
    activation: ActivationRecord;
    plan: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
    billingCycle: 'monthly' | 'annual' | 'custom';
    durationDays: number;
  }> {
    const apiUrl = this.requireApiUrl('/api/subscriptions/redeem');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await parseStrictJsonResponse<{
      activated?: boolean;
      subscription?: UserSubscription;
      activation?: ActivationRecord;
      plan?: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
      billingCycle?: 'monthly' | 'annual' | 'custom';
      durationDays?: number;
    }>(resp);

    if (!data?.subscription || typeof data.subscription !== 'object' || typeof data.subscription.plan !== 'string') {
      throw new Error(
        'Réponse serveur incomplète lors de l’activation du code Redeem. Veuillez réessayer.'
      );
    }

    this.currentSubscription = data.subscription;
    this.notify();
    return {
      subscription: data.subscription,
      activation: data.activation as ActivationRecord,
      plan: (data.plan || data.subscription.plan) as 'PREMIUM' | 'FAMILY' | 'BUSINESS',
      billingCycle: (data.billingCycle || data.subscription.billingCycle || 'monthly') as
        | 'monthly'
        | 'annual'
        | 'custom',
      durationDays: typeof data.durationDays === 'number' ? data.durationDays : 30,
    };
  }

  public async getAdminOverview(): Promise<{
    subscriptions: UserSubscription[];
    businessQuotes: BusinessQuoteRequest[];
    redeemCodes: RedeemCodeRecord[];
    activations: ActivationRecord[];
    stats: AdminOverviewStats;
  }> {
    const apiUrl = this.requireApiUrl('/api/admin/subscriptions');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, { headers });
    return parseStrictJsonResponse(resp);
  }

  public async generateRedeemCodes(params: {
    plan: 'PREMIUM' | 'FAMILY';
    billingCycle: 'monthly' | 'annual';
    count: number;
    note?: string;
  }): Promise<{ codes: RedeemCodeRecord[]; stats: AdminOverviewStats }> {
    const apiUrl = this.requireApiUrl('/api/admin/redeem-codes');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    return parseStrictJsonResponse(resp);
  }

  public async revokeRedeemCode(code: string): Promise<{ code: RedeemCodeRecord; stats: AdminOverviewStats }> {
    const apiUrl = this.requireApiUrl(`/api/admin/redeem-codes/${encodeURIComponent(code)}/revoke`);
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
    });
    return parseStrictJsonResponse(resp);
  }

  public async submitBusinessQuote(payload: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    teamSize: string;
    vehicleCount: string;
    needsApi: boolean;
    message: string;
  }): Promise<BusinessQuoteRequest> {
    const apiUrl = this.requireApiUrl('/api/business/quote');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await parseStrictJsonResponse<{ quote: BusinessQuoteRequest }>(resp);
    return data.quote;
  }

  // --- Family Profiles ---

  public async getFamilyProfiles(): Promise<{ profiles: FamilyMemberProfile[]; maxFamilyMembers: number }> {
    this.ensureFeature('family_dashboard', false);
    const apiUrl = this.requireApiUrl('/api/family/profiles');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, { headers });
    if (resp.status === 403) {
      throw new SubscriptionRequiredError('family_dashboard', 'FAMILY');
    }
    return parseStrictJsonResponse(resp);
  }

  public async addFamilyProfile(payload: {
    name: string;
    relation: FamilyMemberProfile['relation'];
    vruType: VRUType;
    emergencyContactPhone?: string;
    shareLocation?: boolean;
    sosAlertsEnabled?: boolean;
    geofenceAlertEnabled?: boolean;
    speedAlertThresholdKmh?: number;
  }): Promise<FamilyMemberProfile> {
    this.ensureFeature('family_management', true);
    const apiUrl = this.requireApiUrl('/api/family/profiles');
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (resp.status === 403) {
      throw new SubscriptionRequiredError('family_management', 'FAMILY');
    }
    const data = await parseStrictJsonResponse<{ profile: FamilyMemberProfile }>(resp);
    return data.profile;
  }

  public async updateFamilyProfile(
    id: string,
    updates: Partial<Omit<FamilyMemberProfile, 'id' | 'ownerUid' | 'createdAt'>>
  ): Promise<FamilyMemberProfile> {
    this.ensureFeature('family_member_settings', true);
    const apiUrl = this.requireApiUrl(`/api/family/profiles/${encodeURIComponent(id)}`);
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    if (resp.status === 403) {
      throw new SubscriptionRequiredError('family_member_settings', 'FAMILY');
    }
    const data = await parseStrictJsonResponse<{ profile: FamilyMemberProfile }>(resp);
    return data.profile;
  }

  public async removeFamilyProfile(id: string): Promise<void> {
    this.ensureFeature('family_management', true);
    const apiUrl = this.requireApiUrl(`/api/family/profiles/${encodeURIComponent(id)}`);
    const headers = await this.getAuthHeaders();
    const resp = await fetch(apiUrl, {
      method: 'DELETE',
      headers,
    });
    if (!resp.ok) {
      await parseStrictJsonResponse(resp);
    }
  }
}

export const subscriptionService = new SubscriptionService();
