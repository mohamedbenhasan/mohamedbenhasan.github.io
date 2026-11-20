import { auth } from '../firebase';
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
      const headers = await this.getAuthHeaders();
      const resp = await fetch('/api/subscriptions/me', { headers });
      if (!resp.ok) {
        throw new Error('Failed to fetch subscription');
      }
      const data = await resp.json();
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

  public async authorizeServerAction(endpoint: string, feature: FeatureKey): Promise<void> {
    this.ensureFeature(feature, true);
    const headers = await this.getAuthHeaders();
    const resp = await fetch(endpoint, { method: 'POST', headers });
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
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/subscriptions/checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await resp.json().catch(() => ({}));
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
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/subscriptions/verify-payment', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || 'Vérification du paiement échouée.');
    }
    this.currentSubscription = data.subscription;
    this.notify();
    return data.subscription;
  }

  public async cancelSubscription(): Promise<UserSubscription> {
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/subscriptions/cancel', {
      method: 'POST',
      headers,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || 'Échec de l’annulation.');
    }
    this.currentSubscription = data.subscription;
    this.notify();
    return data.subscription;
  }

  public async redeemCode(params: {
    code: string;
    expectedPlan?: 'PREMIUM' | 'FAMILY';
  }): Promise<{
    subscription: UserSubscription;
    activation: ActivationRecord;
    plan: 'PREMIUM' | 'FAMILY';
    billingCycle: 'monthly' | 'annual';
    durationDays: number;
  }> {
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/subscriptions/redeem', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || 'Code Redeem invalide ou expiré.');
    }
    this.currentSubscription = data.subscription;
    this.notify();
    return data;
  }

  public async getAdminOverview(): Promise<{
    subscriptions: UserSubscription[];
    businessQuotes: BusinessQuoteRequest[];
    redeemCodes: RedeemCodeRecord[];
    activations: ActivationRecord[];
    stats: AdminOverviewStats;
  }> {
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/admin/subscriptions', { headers });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || 'Accès administrateur refusé.');
    }
    return data;
  }

  public async generateRedeemCodes(params: {
    plan: 'PREMIUM' | 'FAMILY';
    billingCycle: 'monthly' | 'annual';
    count: number;
    note?: string;
  }): Promise<{ codes: RedeemCodeRecord[]; stats: AdminOverviewStats }> {
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/admin/redeem-codes', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || 'Échec de génération des codes.');
    }
    return data;
  }

  public async revokeRedeemCode(code: string): Promise<{ code: RedeemCodeRecord; stats: AdminOverviewStats }> {
    const headers = await this.getAuthHeaders();
    const resp = await fetch(`/api/admin/redeem-codes/${encodeURIComponent(code)}/revoke`, {
      method: 'POST',
      headers,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || 'Échec de révocation du code.');
    }
    return data;
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
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/business/quote', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || 'Échec de l’envoi de la demande.');
    }
    return data.quote;
  }

  // --- Family Profiles ---

  public async getFamilyProfiles(): Promise<{ profiles: FamilyMemberProfile[]; maxFamilyMembers: number }> {
    this.ensureFeature('family_dashboard', false);
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/family/profiles', { headers });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 403) throw new SubscriptionRequiredError('family_dashboard', 'FAMILY');
      throw new Error(data.error || 'Impossible de charger les profils familiaux.');
    }
    return data;
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
    const headers = await this.getAuthHeaders();
    const resp = await fetch('/api/family/profiles', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 403) throw new SubscriptionRequiredError('family_management', 'FAMILY');
      throw new Error(data.error || 'Impossible d’ajouter le profil.');
    }
    return data.profile;
  }

  public async updateFamilyProfile(
    id: string,
    updates: Partial<Omit<FamilyMemberProfile, 'id' | 'ownerUid' | 'createdAt'>>
  ): Promise<FamilyMemberProfile> {
    this.ensureFeature('family_member_settings', true);
    const headers = await this.getAuthHeaders();
    const resp = await fetch(`/api/family/profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 403) throw new SubscriptionRequiredError('family_member_settings', 'FAMILY');
      throw new Error(data.error || 'Impossible de mettre à jour le profil.');
    }
    return data.profile;
  }

  public async removeFamilyProfile(id: string): Promise<void> {
    this.ensureFeature('family_management', true);
    const headers = await this.getAuthHeaders();
    const resp = await fetch(`/api/family/profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || 'Impossible de supprimer le profil.');
    }
  }
}

export const subscriptionService = new SubscriptionService();
