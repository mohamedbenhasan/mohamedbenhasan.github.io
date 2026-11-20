import {
  BillingCycle,
  FeatureKey,
  PlanEntitlements,
  PlanRegionalConfig,
  PlatformSettings,
  SubscriptionPlan,
  SubscriptionStatus,
  SupportedCurrency,
  UserSubscription,
} from '../types';

export const EARLY_TESTER_ROLLOUT_MS = Date.parse('2026-11-18T10:30:00.000Z');
export const EARLY_TESTER_DURATION_MS = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in ms
export const MONTH_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const YEAR_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  tagline: string;
  monthlyPriceTnd: number | null;
  annualPriceTnd: number | null;
  monthlyPriceEur: number | null;
  annualPriceEur: number | null;
  priceLabelCustom?: string;
  recommended?: boolean;
  badge?: string;
  ctaLabel: string;
  featuresIncluded: string[];
  featuresExcluded?: string[];
}

export const SUBSCRIPTION_PLANS: PlanDefinition[] = [
  {
    id: 'FREE',
    name: 'Free',
    tagline: 'Accès essentiel à la carte et à la navigation urbaine.',
    monthlyPriceTnd: 0,
    annualPriceTnd: 0,
    monthlyPriceEur: 0,
    annualPriceEur: 0,
    ctaLabel: 'Plan de base',
    featuresIncluded: [
      'Création et gestion du compte utilisateur',
      'Localisation GPS de base',
      'Accès complet à la carte interactive',
      'Navigation de base (itinéraire standard)',
      'Consultation des informations et incidents routiers',
    ],
    featuresExcluded: [
      'Bouton et alertes SOS',
      'Ajout et gestion des contacts d’urgence',
      'Alertes automatiques aux contacts d’urgence',
      'Partage de localisation en temps réel',
      'Historique avancé des événements de sécurité',
      'Fonctionnalités intelligentes Premium',
    ],
  },
  {
    id: 'PREMIUM',
    name: 'Premium',
    tagline: 'Protection active complète, SOS, contacts d’urgence et intelligence temps réel.',
    monthlyPriceTnd: 4.9,
    annualPriceTnd: 49,
    monthlyPriceEur: 3.9,
    annualPriceEur: 39,
    recommended: true,
    badge: 'Recommandé',
    ctaLabel: 'Passer à Premium',
    featuresIncluded: [
      'Toutes les fonctionnalités Free incluses',
      'Fonction SOS complète (bouton urgence, catégories & commande vocale)',
      'Contacts d’urgence multiples (jusqu’à 10 contacts)',
      'Alertes automatiques aux contacts d’urgence (Email, SMS, Appel)',
      'Partage de localisation en temps réel sécurisé',
      'Historique détaillé des événements de sécurité & exports CSV/PDF',
      'Localisation intelligente & suivi multi-capteurs (TERIA / RTK)',
      'Navigation intelligente sécurisée, mode PMR & guidage audio',
      'Alertes personnalisées (Smart Conditions météo & console V2X)',
      'Statistiques avancées & analyse IA de sécurité',
      'Global Incident & Risk Heatmap multi-sources & historique',
    ],
  },
  {
    id: 'FAMILY',
    name: 'Family',
    tagline: 'Protection centralisée pour toute la famille avec suivi et alertes partagées.',
    monthlyPriceTnd: 9.9,
    annualPriceTnd: 99,
    monthlyPriceEur: 7.9,
    annualPriceEur: 79,
    ctaLabel: 'Choisir Family',
    featuresIncluded: [
      'Toutes les fonctionnalités Premium incluses',
      'Profils multiples dans la famille (jusqu’à 6 membres)',
      'Gestion centralisée des membres de la famille',
      'Partage de localisation entre membres autorisés',
      'Contacts d’urgence familiaux partagés',
      'Alertes de sécurité dédiées pour les membres de la famille',
      'Tableau de bord familial unifié & suivi parental',
      'Gestion des paramètres de sécurité de chaque membre',
    ],
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    tagline: 'Supervision de flotte, équipes terrain, analytics dédiés et API entreprise.',
    monthlyPriceTnd: null,
    annualPriceTnd: null,
    monthlyPriceEur: null,
    annualPriceEur: null,
    priceLabelCustom: 'Tarif personnalisé',
    ctaLabel: 'Demander un devis',
    featuresIncluded: [
      'Gestion d’équipes et de véhicules',
      'Tableau de bord professionnel multi-opérateurs',
      'Suivi et gestion centralisée des utilisateurs',
      'Statistiques, audits et rapports dédiés',
      'Gestion avancée des alertes de sécurité',
      'API professionnelle et intégrations SI / V2X',
      'Support entreprise prioritaire et SLA dédié',
    ],
  },
];

export interface ComparisonRow {
  category: string;
  label: string;
  free: string | boolean;
  premium: string | boolean;
  family: string | boolean;
  business: string | boolean;
}

export const PLAN_COMPARISON_MATRIX: ComparisonRow[] = [
  {
    category: 'Essentiel',
    label: 'Compte, carte interactive & GPS de base',
    free: true,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Essentiel',
    label: 'Navigation standard & infos routières',
    free: true,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Urgence & Contacts',
    label: 'Bouton SOS & déclenchement vocal d’urgence',
    free: false,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Urgence & Contacts',
    label: 'Gestion des contacts d’urgence',
    free: 'Non disponible',
    premium: 'Jusqu’à 10 contacts',
    family: 'Jusqu’à 10 + Famille',
    business: 'Illimité',
  },
  {
    category: 'Urgence & Contacts',
    label: 'Alertes automatiques (Email / SMS / Appel)',
    free: false,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Urgence & Contacts',
    label: 'Partage de localisation en temps réel',
    free: false,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Intelligence & Sécurité',
    label: 'Historique avancé & rapports CSV / PDF',
    free: false,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Intelligence & Sécurité',
    label: 'Localisation intelligente (TERIA / RTK)',
    free: false,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Intelligence & Sécurité',
    label: 'Routage sécurisé, PMR, Guidage audio & IA',
    free: false,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Intelligence & Sécurité',
    label: 'Global Incident & Risk Heatmap (5 sources + Historique)',
    free: false,
    premium: true,
    family: true,
    business: true,
  },
  {
    category: 'Famille',
    label: 'Profils familiaux & gestion centralisée',
    free: '1 profil',
    premium: '1 profil',
    family: 'Jusqu’à 6 membres',
    business: 'Illimité',
  },
  {
    category: 'Famille',
    label: 'Tableau de bord familial & paramètres membres',
    free: false,
    premium: false,
    family: true,
    business: true,
  },
  {
    category: 'Entreprise',
    label: 'Gestion équipes, véhicules, API pro & support',
    free: false,
    premium: false,
    family: false,
    business: true,
  },
];

export function getEntitlementsForPlan(plan: SubscriptionPlan): PlanEntitlements {
  const isPaidPremiumOrHigher = plan === 'PREMIUM' || plan === 'FAMILY' || plan === 'BUSINESS';
  const isFamilyOrHigher = plan === 'FAMILY' || plan === 'BUSINESS';
  const isBusiness = plan === 'BUSINESS';

  return {
    canUseSos: isPaidPremiumOrHigher,
    canManageEmergencyContacts: isPaidPremiumOrHigher,
    maxEmergencyContacts: isBusiness ? 999 : isPaidPremiumOrHigher ? 10 : 0,
    canUseAutoAlerts: isPaidPremiumOrHigher,
    canShareLiveLocation: isPaidPremiumOrHigher,
    canViewSafetyHistory: isPaidPremiumOrHigher,
    canUseSmartLocalization: isPaidPremiumOrHigher,
    canUseSmartNavigation: isPaidPremiumOrHigher,
    canUseCustomAlerts: isPaidPremiumOrHigher,
    canUseAdvancedStats: isPaidPremiumOrHigher,
    canViewRiskHeatmap: isPaidPremiumOrHigher,
    canUseFamilyDashboard: isFamilyOrHigher,
    maxFamilyMembers: isBusiness ? 999 : plan === 'FAMILY' ? 6 : 1,
    canManageFamilySettings: isFamilyOrHigher,
    canUseBusinessFeatures: isBusiness,
  };
}

export interface RawSubscriptionInput {
  uid: string;
  email?: string | null;
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  billingCycle?: BillingCycle;
  startDate?: number;
  endDate?: number | null;
  isLifetime?: boolean;
  cancelAtPeriodEnd?: boolean;
  isEarlyTester?: boolean;
  earlyTesterStartDate?: number | null;
  earlyTesterEndDate?: number | null;
  isAccessibilityLifetime?: boolean;
  activationSource?: UserSubscription['activationSource'];
  paymentProvider?: UserSubscription['paymentProvider'];
  paymentVerified?: boolean;
  lastPaymentRef?: string | null;
  updatedAt?: number;
}

export function resolveDurationDaysForRedeem(
  durationCode: '1m' | '3m' | '6m' | '12m' | '24m' | 'lifetime'
): number | null {
  switch (durationCode) {
    case '1m':
      return 30;
    case '3m':
      return 90;
    case '6m':
      return 180;
    case '12m':
      return 365;
    case '24m':
      return 730;
    case 'lifetime':
      return null;
    default:
      return 30;
  }
}

export function resolveEffectiveSubscription(
  raw: RawSubscriptionInput,
  nowMs: number = Date.now()
): UserSubscription {
  const basePlan: SubscriptionPlan = raw.plan || 'FREE';
  const startDate = raw.startDate || nowMs;
  const isLifetime = Boolean(raw.isLifetime || raw.isAccessibilityLifetime);
  const endDate = isLifetime ? null : (raw.endDate ?? null);

  const isEarlyTester = Boolean(raw.isEarlyTester);
  const earlyTesterStartDate = raw.earlyTesterStartDate ?? (isEarlyTester ? startDate : null);
  const earlyTesterEndDate =
    raw.earlyTesterEndDate ??
    (isEarlyTester && earlyTesterStartDate ? earlyTesterStartDate + EARLY_TESTER_DURATION_MS : null);

  const isSuspended = raw.status === 'suspended';

  const earlyTesterActive =
    !isSuspended &&
    isEarlyTester &&
    earlyTesterEndDate !== null &&
    earlyTesterEndDate > nowMs;

  const accessibilityActive = !isSuspended && Boolean(raw.isAccessibilityLifetime);

  const paidActive =
    !isSuspended &&
    basePlan !== 'FREE' &&
    raw.status === 'active' &&
    Boolean(
      raw.paymentVerified ||
        raw.paymentProvider === 'admin' ||
        raw.paymentProvider === 'redeem' ||
        raw.paymentProvider === 'accessibility'
    ) &&
    (isLifetime ||
      (basePlan === 'BUSINESS'
        ? endDate === null || endDate > nowMs
        : endDate !== null && endDate > nowMs));

  let effectivePlan: SubscriptionPlan = 'FREE';
  let status: SubscriptionStatus = raw.status || 'active';

  if (isSuspended) {
    effectivePlan = 'FREE';
    status = 'suspended';
  } else if (paidActive) {
    effectivePlan = basePlan;
    status = 'active';
  } else if (accessibilityActive) {
    effectivePlan = 'PREMIUM';
    status = 'active';
  } else if (earlyTesterActive) {
    effectivePlan = 'PREMIUM';
    status = 'active';
  } else {
    effectivePlan = 'FREE';
    if (
      basePlan !== 'FREE' ||
      (isEarlyTester && earlyTesterEndDate !== null && earlyTesterEndDate <= nowMs)
    ) {
      status = raw.status === 'canceled' ? 'canceled' : 'expired';
    } else {
      status = 'active';
    }
  }

  return {
    uid: raw.uid,
    email: raw.email ?? null,
    plan: basePlan,
    effectivePlan,
    status,
    billingCycle: raw.billingCycle || 'monthly',
    startDate,
    endDate,
    isLifetime,
    cancelAtPeriodEnd: Boolean(raw.cancelAtPeriodEnd),
    isEarlyTester,
    earlyTesterStartDate,
    earlyTesterEndDate,
    earlyTesterBadge: earlyTesterActive ? 'Pioneer — Premium gratuit 2 ans' : null,
    isAccessibilityLifetime: Boolean(raw.isAccessibilityLifetime),
    activationSource:
      raw.activationSource ??
      (accessibilityActive
        ? 'accessibility'
        : earlyTesterActive
        ? 'pioneer'
        : (raw.paymentProvider as UserSubscription['activationSource']) || 'free'),
    paymentProvider:
      raw.paymentProvider ??
      (accessibilityActive ? 'accessibility' : earlyTesterActive ? 'early_tester' : null),
    paymentVerified: Boolean(raw.paymentVerified || earlyTesterActive || accessibilityActive),
    lastPaymentRef: raw.lastPaymentRef ?? null,
    updatedAt: raw.updatedAt || nowMs,
    entitlements: getEntitlementsForPlan(effectivePlan),
  };
}

export function hasFeatureAccess(
  subscription: UserSubscription | null | undefined,
  feature: FeatureKey
): boolean {
  if (!subscription) return false;
  const e = subscription.entitlements;
  switch (feature) {
    case 'sos':
      return e.canUseSos;
    case 'emergency_contacts':
      return e.canManageEmergencyContacts;
    case 'auto_emergency_alerts':
      return e.canUseAutoAlerts;
    case 'realtime_location_sharing':
      return e.canShareLiveLocation;
    case 'safety_history':
      return e.canViewSafetyHistory;
    case 'smart_localization':
      return e.canUseSmartLocalization;
    case 'smart_navigation':
      return e.canUseSmartNavigation;
    case 'custom_alerts':
      return e.canUseCustomAlerts;
    case 'advanced_stats':
      return e.canUseAdvancedStats;
    case 'global_risk_heatmap':
      return e.canViewRiskHeatmap;
    case 'family_profiles':
    case 'family_management':
    case 'family_location_sharing':
    case 'family_emergency_contacts':
    case 'family_safety_alerts':
    case 'family_dashboard':
      return e.canUseFamilyDashboard;
    case 'family_member_settings':
      return e.canManageFamilySettings;
    case 'business_fleet':
    case 'business_api':
      return e.canUseBusinessFeatures;
    default:
      return false;
  }
}

export function getRequiredPlanForFeature(feature: FeatureKey): SubscriptionPlan {
  switch (feature) {
    case 'family_profiles':
    case 'family_management':
    case 'family_location_sharing':
    case 'family_emergency_contacts':
    case 'family_safety_alerts':
    case 'family_dashboard':
    case 'family_member_settings':
      return 'FAMILY';
    case 'business_fleet':
    case 'business_api':
      return 'BUSINESS';
    default:
      return 'PREMIUM';
  }
}

export const DEFAULT_REGIONAL_PLANS: Record<SubscriptionPlan, PlanRegionalConfig> = {
  FREE: {
    id: 'FREE',
    enabled: true,
    monthlyPriceTnd: 0,
    annualPriceTnd: 0,
    monthlyPriceEur: 0,
    annualPriceEur: 0,
  },
  PREMIUM: {
    id: 'PREMIUM',
    enabled: true,
    monthlyPriceTnd: 4.9,
    annualPriceTnd: 49,
    monthlyPriceEur: 3.9,
    annualPriceEur: 39,
  },
  FAMILY: {
    id: 'FAMILY',
    enabled: true,
    monthlyPriceTnd: 9.9,
    annualPriceTnd: 99,
    monthlyPriceEur: 7.9,
    annualPriceEur: 79,
  },
  BUSINESS: {
    id: 'BUSINESS',
    enabled: true,
    monthlyPriceTnd: null,
    annualPriceTnd: null,
    monthlyPriceEur: null,
    annualPriceEur: null,
    customPricing: true,
  },
};

export function getCurrencyForCountry(countryCode?: string | null): SupportedCurrency {
  if (typeof countryCode === 'string' && countryCode.trim().toUpperCase() === 'TN') {
    return 'TND';
  }
  return 'EUR';
}

export function formatPrice(
  amount: number | null | undefined,
  currency: SupportedCurrency = 'EUR'
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'Tarif personnalisé';
  }
  if (amount === 0) {
    return currency === 'TND' ? '0 TND' : '0 €';
  }
  if (currency === 'TND') {
    const clean = Number.isInteger(amount)
      ? String(amount)
      : amount.toFixed(Math.abs(amount * 10 - Math.round(amount * 10)) < 0.001 ? 1 : 2);
    return `${clean.replace('.', ',')} TND`;
  }
  const cleanEur = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${cleanEur.replace('.', ',')} €`;
}

export function formatTndPrice(amount: number | null): string {
  return formatPrice(amount, 'TND');
}

export function getRegionalPlanPricing(
  planId: SubscriptionPlan,
  config?: {
    planPrices?: Partial<PlatformSettings['planPrices']>;
    regionalPlans?: Partial<Record<SubscriptionPlan, PlanRegionalConfig>>;
  } | null
): PlanRegionalConfig {
  const base = DEFAULT_REGIONAL_PLANS[planId];
  const fromCatalog = config?.regionalPlans?.[planId];
  const pp = config?.planPrices;

  if (planId === 'PREMIUM') {
    return {
      ...base,
      ...fromCatalog,
      id: 'PREMIUM',
      enabled: fromCatalog?.enabled ?? true,
      monthlyPriceTnd: fromCatalog?.monthlyPriceTnd ?? pp?.premiumMonthlyTnd ?? base.monthlyPriceTnd,
      annualPriceTnd: fromCatalog?.annualPriceTnd ?? pp?.premiumAnnualTnd ?? base.annualPriceTnd,
      monthlyPriceEur: fromCatalog?.monthlyPriceEur ?? pp?.premiumMonthlyEur ?? base.monthlyPriceEur,
      annualPriceEur: fromCatalog?.annualPriceEur ?? pp?.premiumAnnualEur ?? base.annualPriceEur,
    };
  }

  if (planId === 'FAMILY') {
    return {
      ...base,
      ...fromCatalog,
      id: 'FAMILY',
      enabled: fromCatalog?.enabled ?? true,
      monthlyPriceTnd: fromCatalog?.monthlyPriceTnd ?? pp?.familyMonthlyTnd ?? base.monthlyPriceTnd,
      annualPriceTnd: fromCatalog?.annualPriceTnd ?? pp?.familyAnnualTnd ?? base.annualPriceTnd,
      monthlyPriceEur: fromCatalog?.monthlyPriceEur ?? pp?.familyMonthlyEur ?? base.monthlyPriceEur,
      annualPriceEur: fromCatalog?.annualPriceEur ?? pp?.familyAnnualEur ?? base.annualPriceEur,
    };
  }

  return {
    ...base,
    ...fromCatalog,
    id: planId,
    enabled: fromCatalog?.enabled ?? true,
  };
}

export function getPlanPrice(
  planId: SubscriptionPlan,
  billingCycle: BillingCycle,
  currency: SupportedCurrency,
  config?: {
    planPrices?: Partial<PlatformSettings['planPrices']>;
    regionalPlans?: Partial<Record<SubscriptionPlan, PlanRegionalConfig>>;
  } | null
): number | null {
  const regional = getRegionalPlanPricing(planId, config);
  if (currency === 'TND') {
    return billingCycle === 'annual' ? regional.annualPriceTnd : regional.monthlyPriceTnd;
  }
  return billingCycle === 'annual' ? regional.annualPriceEur : regional.monthlyPriceEur;
}

export function isPlanActiveInCatalog(
  planId: SubscriptionPlan,
  config?: {
    planPrices?: Partial<PlatformSettings['planPrices']>;
    regionalPlans?: Partial<Record<SubscriptionPlan, PlanRegionalConfig>>;
  } | null
): boolean {
  return getRegionalPlanPricing(planId, config).enabled !== false;
}

export const PAYMENT_PROVIDER_CURRENCIES: Record<'konnect' | 'stripe', SupportedCurrency[]> = {
  konnect: ['TND'],
  stripe: ['EUR', 'TND'],
};

export function isProviderCompatibleWithCurrency(
  provider: 'stripe' | 'konnect',
  currency: SupportedCurrency
): boolean {
  return PAYMENT_PROVIDER_CURRENCIES[provider]?.includes(currency) ?? false;
}

export function getCompatibleProvidersForCurrency(
  currency: SupportedCurrency
): Array<'stripe' | 'konnect'> {
  return currency === 'TND' ? ['konnect', 'stripe'] : ['stripe'];
}

export function toStripeUnitAmount(amount: number, currency: SupportedCurrency): number {
  // ISO-4217 minor units: TND has 3 decimal places (millimes), EUR has 2 decimal places (cents)
  return currency === 'TND' ? Math.round(amount * 1000) : Math.round(amount * 100);
}
