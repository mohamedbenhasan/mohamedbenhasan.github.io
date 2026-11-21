import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  X,
  Sparkles,
  Users,
  Building2,
  Award,
  Ticket,
  Loader2,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Lock,
  CreditCard,
  Ban,
} from 'lucide-react';
import { toast } from '../services/NotificationService';
import { useAuth } from '../AuthContext';
import { subscriptionService } from '../services/SubscriptionService';
import {
  ActivationRecord,
  BillingCycle,
  SubscriptionPlan,
} from '../types';
import {
  formatPrice,
  getCompatibleProvidersForCurrency,
  getPlanPrice,
  isPlanActiveInCatalog,
  isProviderCompatibleWithCurrency,
  PLAN_COMPARISON_MATRIX,
  SUBSCRIPTION_PLANS,
} from '../utils/subscriptionPlans';
import { ThemeToggle } from './ThemeToggle';
import { CurrencySelector } from './CurrencySelector';
import { AccessibilityApplicationModal } from './AccessibilityAndSupportModals';
import { VruLogo } from './VruLogo';

interface Props {
  onBack: () => void;
  onRequireLogin?: () => void;
  onOpenProfile?: () => void;
  initialHighlightPlan?: SubscriptionPlan;
}

export const PricingPage: React.FC<Props> = ({
  onBack,
  onRequireLogin,
  onOpenProfile,
  initialHighlightPlan,
}) => {
  const {
    user,
    subscription,
    effectivePlan,
    refreshSubscription,
    publicConfig,
    currency,
    detectedCountry,
  } = useAuth();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<'PREMIUM' | 'FAMILY' | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'stripe' | 'konnect'>('stripe');
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);

  // Redeem workflow state
  const [selectedRedeemPlan, setSelectedRedeemPlan] = useState<'AUTO' | 'PREMIUM' | 'FAMILY'>(
    initialHighlightPlan === 'FAMILY'
      ? 'FAMILY'
      : initialHighlightPlan === 'PREMIUM'
      ? 'PREMIUM'
      : 'AUTO'
  );
  const [redeemInput, setRedeemInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [activatedResult, setActivatedResult] = useState<{
    plan: SubscriptionPlan;
    billingCycle?: BillingCycle | null;
    endDate?: number | null;
    activation: ActivationRecord;
  } | null>(null);

  const redeemInputRef = useRef<HTMLInputElement>(null);
  const redeemSectionRef = useRef<HTMLDivElement>(null);

  const gatewaysConfigured = subscriptionService.getGatewaysConfigured();
  const compatibleProviders = getCompatibleProvidersForCurrency(currency);

  useEffect(() => {
    if (!isProviderCompatibleWithCurrency(selectedProvider, currency)) {
      setSelectedProvider(compatibleProviders[0] || 'stripe');
    }
  }, [currency, selectedProvider, compatibleProviders]);

  // Business quote modal state
  const [showBusinessModal, setShowBusinessModal] = useState(initialHighlightPlan === 'BUSINESS');
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    companyName: '',
    contactName: user?.displayName || '',
    email: user?.email || '',
    phone: '',
    teamSize: '10-50',
    vehicleCount: '5-20',
    needsApi: true,
    message: '',
  });

  // Keep silent return URL handler if an external checkout redirect ever hits URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnProvider = params.get('provider') as 'stripe' | 'konnect' | null;
    const sessionId = params.get('session_id');
    const paymentRef = params.get('payment_ref') || params.get('paymentRef');
    const paymentStatus = params.get('payment_status');

    if (paymentStatus === 'cancelled' || paymentStatus === 'failed') {
      toast.info('Opération annulée. Votre abonnement actuel reste inchangé.');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (user && returnProvider && (sessionId || paymentRef)) {
      setVerifyingPayment(true);
      subscriptionService
        .verifyPayment({
          provider: returnProvider,
          sessionId: sessionId || undefined,
          paymentRef: paymentRef || undefined,
        })
        .then(async () => {
          await refreshSubscription();
          toast.success('Abonnement vérifié et activé.');
        })
        .catch((err) => {
          toast.error(err.message || 'Vérification impossible.');
        })
        .finally(() => {
          setVerifyingPayment(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, [user, refreshSubscription]);

  const isEarlyTesterActive = Boolean(
    subscription?.isEarlyTester &&
      subscription?.earlyTesterEndDate &&
      subscription.earlyTesterEndDate > Date.now()
  );

  const scrollToRedeem = (planHint?: 'PREMIUM' | 'FAMILY') => {
    if (planHint) {
      setSelectedRedeemPlan(planHint);
    }
    redeemSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => redeemInputRef.current?.focus(), 320);
  };

  const handleSelectPlan = (planId: SubscriptionPlan) => {
    if (!isPlanActiveInCatalog(planId, publicConfig)) {
      toast.warning(`La formule ${planId} est actuellement indisponible.`);
      return;
    }
    if (planId === 'FREE') {
      onBack();
      return;
    }
    if (planId === 'BUSINESS') {
      setShowBusinessModal(true);
      return;
    }
    if (!user) {
      toast.info('Connectez-vous pour souscrire ou activer un code Redeem.');
      onRequireLogin?.();
      return;
    }
    if (planId === 'PREMIUM' && isEarlyTesterActive) {
      toast.success('Votre accès gratuit Early Tester (2 ans) à Premium est déjà actif.');
      return;
    }
    const defaultProvider: 'stripe' | 'konnect' =
      currency === 'TND' && gatewaysConfigured.konnect ? 'konnect' : 'stripe';
    setSelectedProvider(defaultProvider);
    setCheckoutPlan(planId === 'FAMILY' ? 'FAMILY' : 'PREMIUM');
  };

  const handleStartOnlineCheckout = async () => {
    if (!checkoutPlan) return;
    if (!user) {
      onRequireLogin?.();
      return;
    }
    setStartingCheckout(true);
    try {
      const countryPayload =
        currency === 'TND' ? 'TN' : detectedCountry && detectedCountry !== 'TN' ? detectedCountry : 'FR';
      const result = await subscriptionService.createCheckoutSession({
        plan: checkoutPlan,
        billingCycle,
        provider: selectedProvider,
        country: countryPayload,
        currency,
      });
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      } else {
        toast.info('Redirection checkout prête.');
      }
    } catch (err: any) {
      if (err?.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
        toast.info('Passerelle en ligne non configurée sur cet environnement — activez votre formule par code Redeem ci-dessous.');
        const planHint = checkoutPlan;
        setCheckoutPlan(null);
        scrollToRedeem(planHint);
        return;
      }
      toast.error(err?.message || 'Impossible de lancer le paiement.');
    } finally {
      setStartingCheckout(false);
    }
  };

  const handleRedeemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemError(null);
    setActivatedResult(null);

    if (!user) {
      toast.info('Veuillez vous connecter pour activer un abonnement avec un code Redeem.');
      onRequireLogin?.();
      return;
    }

    const cleaned = redeemInput.trim().toUpperCase();
    if (!cleaned) {
      setRedeemError('Veuillez saisir votre code Redeem.');
      return;
    }

    setRedeeming(true);
    try {
      const expectedPlan = selectedRedeemPlan === 'AUTO' ? undefined : selectedRedeemPlan;
      const result = await subscriptionService.redeemCode({
        code: cleaned,
        expectedPlan,
      });
      const resolvedPlan = result.subscription?.plan || result.plan || result.activation?.plan;
      if (!resolvedPlan) {
        throw new Error('Réponse d’activation invalide. Veuillez réessayer.');
      }
      await refreshSubscription();
      setActivatedResult({
        plan: resolvedPlan,
        billingCycle: result.subscription?.billingCycle || result.billingCycle || 'monthly',
        endDate: result.subscription?.endDate ?? result.activation?.endDate ?? null,
        activation: result.activation,
      });
      setRedeemInput('');
      toast.success(`Abonnement ${resolvedPlan} activé avec succès.`);
    } catch (err: any) {
      const message = err?.message || 'Code Redeem invalide ou déjà utilisé.';
      setRedeemError(message);
      toast.error(message);
    } finally {
      setRedeeming(false);
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingQuote(true);
    try {
      await subscriptionService.submitBusinessQuote(quoteForm);
      setQuoteSent(true);
      toast.success('Demande de devis Business envoyée.');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi.");
    } finally {
      setSubmittingQuote(false);
    }
  };

  const formatDate = (ms?: number | null) => {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const statusLabel = () => {
    if (isEarlyTesterActive) return 'Actif (Early Tester)';
    if (!subscription || effectivePlan === 'FREE') return 'Actif (Gratuit)';
    if (subscription.status === 'canceled' || subscription.cancelAtPeriodEnd) return 'Annulé';
    if (subscription.status === 'expired') return 'Expiré';
    return 'Actif';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-y-auto flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <div className="flex items-center gap-2">
            <VruLogo className="w-7 h-7 rounded-lg" />
            <span className="font-display font-bold text-base text-white">
              Abonnements VruGuard
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user && onOpenProfile && (
              <button
                onClick={onOpenProfile}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mon espace
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-10 space-y-10 flex-1">
        {/* Intro */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
            Offres &amp; Activation par code Redeem
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Choisissez la protection adaptée à vos trajets
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            La carte, la localisation GPS de base et les informations routières sont accessibles gratuitement. Débloquez le bouton SOS, les contacts d&apos;urgence et la protection familiale en activant un code Redeem Premium ou Family.
          </p>

          {/* Billing cycle & Currency switchers */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <div className="inline-flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-blue-600 text-[#ffffff]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
                  billingCycle === 'annual'
                    ? 'bg-blue-600 text-[#ffffff]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Annuel
                <span className="text-[10px] font-mono text-emerald-400">-17%</span>
              </button>
            </div>

            <CurrencySelector />
          </div>
        </section>

        {/* Verifying Banner if legacy URL redirect occurs */}
        {verifyingPayment && (
          <div className="bg-blue-950/40 border border-blue-500/40 rounded-xl p-4 flex items-center gap-3 text-sm text-blue-200 max-w-3xl mx-auto">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400 shrink-0" />
            <span>Vérification sécurisée de votre activation auprès du serveur en cours...</span>
          </div>
        )}

        {/* Current Subscription Status Card */}
        {user && subscription && (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-semibold uppercase tracking-wider text-slate-400">
                  Offre actuelle :
                </span>
                <span className="font-display font-bold text-sm text-blue-400">
                  {effectivePlan}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300 font-medium">{statusLabel()}</span>
                {isEarlyTesterActive && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                      <Award className="w-3.5 h-3.5" />
                      Early Tester (2 ans Premium offerts)
                    </span>
                  </>
                )}
              </div>

              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-4 tabular-nums">
                {isEarlyTesterActive ? (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      Début : {formatDate(subscription.earlyTesterStartDate)}
                    </span>
                    <span className="text-amber-300">
                      Expiration : {formatDate(subscription.earlyTesterEndDate)}
                    </span>
                  </>
                ) : effectivePlan !== 'FREE' ? (
                  <>
                    <span>Début : {formatDate(subscription.startDate)}</span>
                    <span>Expiration : {formatDate(subscription.endDate)}</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    Formule Free — SOS et contacts d&apos;urgence réservés à Premium et Family.
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => scrollToRedeem()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors inline-flex items-center gap-2 self-start md:self-auto shrink-0"
            >
              <Ticket className="w-4 h-4 text-emerald-400" />
              Activer un code Redeem
            </button>
          </section>
        )}

        {/* 4 Plan Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = effectivePlan === plan.id;
            const isRecommended = Boolean(plan.recommended);
            const isHighlighted = initialHighlightPlan === plan.id || isRecommended;
            const planEnabled = isPlanActiveInCatalog(plan.id, publicConfig);

            const dynamicMonthly = getPlanPrice(plan.id, 'monthly', currency, publicConfig);
            const dynamicAnnual = getPlanPrice(plan.id, 'annual', currency, publicConfig);
            const displayedPrice = billingCycle === 'annual' ? dynamicAnnual : dynamicMonthly;

            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-6 transition-colors ${
                  !planEnabled
                    ? 'bg-slate-900/40 border-slate-800/70 opacity-75'
                    : isRecommended
                    ? 'bg-slate-900 border-blue-500 shadow-xl shadow-blue-950/30'
                    : isHighlighted
                    ? 'bg-slate-900 border-indigo-500/70'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                    {plan.id === 'PREMIUM' && <Sparkles className="w-4 h-4 text-blue-400" />}
                    {plan.id === 'FAMILY' && <Users className="w-4 h-4 text-indigo-400" />}
                    {plan.id === 'BUSINESS' && <Building2 className="w-4 h-4 text-emerald-400" />}
                    {plan.name}
                  </h2>
                  {!planEnabled ? (
                    <span className="text-[11px] font-semibold text-amber-400 inline-flex items-center gap-1">
                      <Ban className="w-3 h-3" />
                      Désactivé
                    </span>
                  ) : plan.badge ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                      {plan.badge}
                    </span>
                  ) : null}
                  {planEnabled && isCurrent && !plan.badge && (
                    <span className="text-[11px] font-semibold text-emerald-400">Actif</span>
                  )}
                </div>

                <p className="text-xs text-slate-400 min-h-[36px] mb-5">{plan.tagline}</p>

                {/* Price */}
                <div className="mb-6 pb-5 border-b border-slate-800 tabular-nums">
                  {displayedPrice !== null ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-3xl font-bold text-white">
                        {formatPrice(displayedPrice, currency)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {billingCycle === 'annual' && displayedPrice > 0 ? '/an' : '/mois'}
                      </span>
                    </div>
                  ) : (
                    <div className="font-display text-2xl font-bold text-white">
                      Sur devis
                    </div>
                  )}
                  {dynamicMonthly !== null &&
                    dynamicAnnual !== null &&
                    dynamicMonthly > 0 && (
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        {billingCycle === 'monthly'
                          ? `Ou ${formatPrice(dynamicAnnual, currency)}/an`
                          : `Soit ${formatPrice(Math.round((dynamicAnnual / 12) * 100) / 100, currency)}/mois`}
                      </div>
                    )}
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={
                    !planEnabled ||
                    (isCurrent &&
                      plan.id !== 'BUSINESS' &&
                      !(plan.id === 'PREMIUM' && isEarlyTesterActive))
                  }
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors mb-6 flex items-center justify-center gap-2 disabled:opacity-50 ${
                    !planEnabled
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                      : isCurrent && plan.id !== 'BUSINESS'
                      ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : plan.id === 'PREMIUM'
                      ? 'bg-blue-600 hover:bg-blue-500 text-[#ffffff]'
                      : plan.id === 'FAMILY'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-[#ffffff]'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  }`}
                >
                  {!planEnabled
                    ? 'Indisponible'
                    : isCurrent && plan.id === 'PREMIUM' && isEarlyTesterActive
                    ? 'Actif (Early Tester 2 ans)'
                    : isCurrent && plan.id !== 'BUSINESS'
                    ? 'Formule actuelle'
                    : plan.id === 'FREE'
                    ? 'Utiliser gratuitement'
                    : plan.id === 'BUSINESS'
                    ? 'Demander un devis'
                    : `Choisir ${plan.name}`}
                </button>

                {/* Features list */}
                <div className="space-y-2.5 flex-1">
                  {plan.featuresIncluded.map((feat) => (
                    <div key={feat} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                  {plan.featuresExcluded?.map((feat) => (
                    <div key={feat} className="flex items-start gap-2.5 text-xs text-slate-500">
                      <X className="w-4 h-4 text-red-400/70 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Online Checkout Confirmation Panel (when a paid plan is selected) */}
        {checkoutPlan && (
          <section className="bg-slate-900 border border-blue-500/45 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                  Finalisation · Devise {currency}
                </p>
                <h2 className="font-display text-lg font-bold text-white">
                  Souscrire à VruGuard {checkoutPlan} ({billingCycle === 'annual' ? 'Annuel' : 'Mensuel'})
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Montant officiel vérifié côté serveur :{' '}
                  <span className="font-mono font-bold text-white tabular-nums">
                    {formatPrice(getPlanPrice(checkoutPlan, billingCycle, currency, publicConfig), currency)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutPlan(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Prestataire de paiement compatible ({currency})
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={!isProviderCompatibleWithCurrency('konnect', currency)}
                    onClick={() => setSelectedProvider('konnect')}
                    className={`p-3 rounded-xl border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      selectedProvider === 'konnect'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Konnect</div>
                    <div className="text-[11px] text-slate-400">
                      {currency === 'TND' ? 'Dinar Tunisien (TND)' : 'Uniquement TND'}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!isProviderCompatibleWithCurrency('stripe', currency)}
                    onClick={() => setSelectedProvider('stripe')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      selectedProvider === 'stripe'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Stripe (Carte)</div>
                    <div className="text-[11px] text-slate-400">
                      Compatible EUR &amp; TND
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const target = checkoutPlan;
                    setCheckoutPlan(null);
                    scrollToRedeem(target);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-2"
                >
                  <Ticket className="w-4 h-4 text-emerald-400" />
                  Utiliser un code Redeem
                </button>
                <button
                  type="button"
                  disabled={startingCheckout}
                  onClick={handleStartOnlineCheckout}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {startingCheckout ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  Payer {formatPrice(getPlanPrice(checkoutPlan, billingCycle, currency, publicConfig), currency)}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* GUIDED REDEEM CODE ACTIVATION SECTION */}
        <section
          ref={redeemSectionRef}
          id="redeem-panel"
          className="bg-slate-900 border border-blue-500/35 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                    Activation immédiate
                  </p>
                  <h2 className="font-display text-xl font-bold text-white">
                    Activer un abonnement par code Redeem
                  </h2>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Le paiement en ligne n’est pas requis. Saisissez le code officiel délivré par l’administration VruGuard pour activer votre formule Premium ou Family et débloquer instantanément le SOS et les contacts d&apos;urgence.
              </p>

              <div className="space-y-2 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-400">1.</span>
                  <span>Sélectionnez la formule visée ou laissez la détection automatique</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-400">2.</span>
                  <span>Saisissez votre code (ex. VRU-PREM-XXXX-XXXX)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-400">3.</span>
                  <span>Validez pour débloquer l&apos;abonnement et enregistrer l&apos;historique</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <form onSubmit={handleRedeemSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Formule associée au code
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(
                      [
                        { id: 'AUTO', label: 'Détection auto' },
                        { id: 'PREMIUM', label: 'Premium' },
                        { id: 'FAMILY', label: 'Family' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedRedeemPlan(opt.id)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                          selectedRedeemPlan === opt.id
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="pricing-redeem-input"
                    className="block text-xs font-semibold text-slate-300 mb-2"
                  >
                    Code Redeem
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      ref={redeemInputRef}
                      id="pricing-redeem-input"
                      type="text"
                      value={redeemInput}
                      onChange={(e) => {
                        setRedeemInput(e.target.value.toUpperCase());
                        setRedeemError(null);
                      }}
                      placeholder="VRU-PREM-XXXX-XXXX"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono tracking-wider text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 uppercase"
                    />
                    <button
                      type="submit"
                      disabled={redeeming}
                      className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                    >
                      {redeeming && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{user ? 'Activer le code' : 'Se connecter pour activer'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {redeemError && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-300">
                    {redeemError}
                  </div>
                )}

                {activatedResult && (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2 animate-fade-up">
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Abonnement {activatedResult.plan} activé (
                        {activatedResult.billingCycle === 'annual' ? 'Annuel' : 'Mensuel'})
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                      <span>Code / Source : {activatedResult.activation.code || activatedResult.activation.source}</span>
                      <span>Début : {formatDate(activatedResult.activation.activatedAt)}</span>
                      <span>
                        Expiration :{' '}
                        {activatedResult.activation.isLifetime
                          ? 'À vie'
                          : formatDate(activatedResult.endDate)}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200/90">
                      Le bouton SOS, les contacts d&apos;urgence et toutes les fonctions de l&apos;offre sont désormais disponibles sur votre compte.
                    </p>
                  </div>
                )}
              </form>
            </div>
          </div>
        </section>

        {/* Detailed Comparison Table */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-800">
            <h2 className="font-display text-lg font-bold text-white">
              Comparatif détaillé des abonnements
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Les fonctionnalités SOS et la gestion des contacts d&apos;urgence sont strictement réservées aux formules Premium, Family et Business.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5 font-semibold">Fonctionnalité</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Free</th>
                  <th className="py-3.5 px-4 font-semibold text-center text-blue-400">Premium</th>
                  <th className="py-3.5 px-4 font-semibold text-center text-indigo-400">Family</th>
                  <th className="py-3.5 px-4 font-semibold text-center text-emerald-400">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {PLAN_COMPARISON_MATRIX.map((row) => {
                  const renderCell = (val: string | boolean) => {
                    if (val === true) {
                      return <Check className="w-4 h-4 text-emerald-400 mx-auto" />;
                    }
                    if (val === false) {
                      return <X className="w-4 h-4 text-slate-600 mx-auto" />;
                    }
                    return <span className="text-slate-300 font-medium">{val}</span>;
                  };
                  return (
                    <tr key={row.label} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5 text-slate-200 font-medium">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                          {row.category}
                        </span>
                        {row.label}
                      </td>
                      <td className="py-3.5 px-4 text-center">{renderCell(row.free)}</td>
                      <td className="py-3.5 px-4 text-center bg-blue-950/10">{renderCell(row.premium)}</td>
                      <td className="py-3.5 px-4 text-center">{renderCell(row.family)}</td>
                      <td className="py-3.5 px-4 text-center">{renderCell(row.business)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Payment Transactions History (when user has recorded transactions) */}
        {user && subscription?.transactions && subscription.transactions.length > 0 && (
          <section className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">
                Transactions enregistrées
              </h2>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {subscription.transactions.length} opération{subscription.transactions.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold">Plan</th>
                    <th className="py-3 px-4 font-semibold">Montant</th>
                    <th className="py-3 px-4 font-semibold">Prestataire</th>
                    <th className="py-3 px-4 font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {subscription.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-5 text-slate-300 tabular-nums">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">
                        {tx.plan} ({tx.billingCycle === 'annual' ? 'Annuel' : 'Mensuel'})
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200 tabular-nums">
                        {formatPrice(tx.amount ?? tx.amountTnd ?? 0, tx.currency || 'TND')}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 uppercase">
                        {tx.provider}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${
                            tx.status === 'verified'
                              ? 'text-emerald-400'
                              : tx.status === 'failed'
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {tx.status === 'verified'
                            ? 'Vérifié'
                            : tx.status === 'pending'
                            ? 'En attente'
                            : tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {/* Accessibility Program CTA */}
        {publicConfig?.accessibilityProgramEnabled !== false && (
          <section className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-white">
                Programme Accessibilité &amp; Handicap — VruGuard Premium offert à vie
              </h3>
              <p className="text-xs text-slate-400">
                Les personnes en situation de handicap ou à mobilité réduite bénéficient gratuitement et à vie de toutes les protections Premium (bouton SOS, contacts d&apos;urgence, navigation sécurisée).
              </p>
            </div>
            <button
              onClick={() => {
                if (!user) {
                  toast.info('Connectez-vous pour déposer votre demande Accessibilité.');
                  onRequireLogin?.();
                  return;
                }
                setShowAccessibilityModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold shrink-0"
            >
              Déposer un dossier
            </button>
          </section>
        )}
      </main>

      {user && (
        <AccessibilityApplicationModal
          open={showAccessibilityModal}
          defaultName={user.displayName || user.email?.split('@')[0] || ''}
          onClose={() => setShowAccessibilityModal(false)}
        />
      )}

      {/* Business Quote Modal */}
      {showBusinessModal && (
        <div
          className="fixed inset-0 z-[120000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display text-lg font-bold text-white">
                  VruGuard Business — Devis personnalisé
                </h3>
              </div>
              <button
                onClick={() => setShowBusinessModal(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quoteSent ? (
              <div className="p-8 text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="font-display text-lg font-bold text-white">Demande enregistrée</h4>
                <p className="text-sm text-slate-400">
                  Notre équipe commerciale VruGuard Business vous contactera sous 24h ouvrées pour établir votre proposition sur mesure.
                </p>
                <button
                  onClick={() => {
                    setShowBusinessModal(false);
                    setQuoteSent(false);
                  }}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-[#ffffff] rounded-xl text-sm font-semibold"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitQuote} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Entreprise *
                    </label>
                    <input
                      type="text"
                      required
                      value={quoteForm.companyName}
                      onChange={(e) => setQuoteForm({ ...quoteForm, companyName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Nom du contact *
                    </label>
                    <input
                      type="text"
                      required
                      value={quoteForm.contactName}
                      onChange={(e) => setQuoteForm({ ...quoteForm, contactName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      E-mail professionnel *
                    </label>
                    <input
                      type="email"
                      required
                      value={quoteForm.email}
                      onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={quoteForm.phone}
                      onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                      placeholder="+216 ..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Taille d&apos;équipe
                    </label>
                    <select
                      value={quoteForm.teamSize}
                      onChange={(e) => setQuoteForm({ ...quoteForm, teamSize: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    >
                      <option value="1-10">1 – 10</option>
                      <option value="10-50">10 – 50</option>
                      <option value="50-200">50 – 200</option>
                      <option value="200+">200+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Véhicules / Flotte
                    </label>
                    <select
                      value={quoteForm.vehicleCount}
                      onChange={(e) => setQuoteForm({ ...quoteForm, vehicleCount: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    >
                      <option value="0-5">0 – 5</option>
                      <option value="5-20">5 – 20</option>
                      <option value="20-100">20 – 100</option>
                      <option value="100+">100+</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quoteForm.needsApi}
                    onChange={(e) => setQuoteForm({ ...quoteForm, needsApi: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-blue-600"
                  />
                  Besoin d&apos;intégration API / Webhooks V2X &amp; supervision flotte
                </label>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Besoins spécifiques
                  </label>
                  <textarea
                    rows={3}
                    value={quoteForm.message}
                    onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })}
                    placeholder="Décrivez vos cas d'usage (livraison, sécurité chantier, municipalité...)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBusinessModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingQuote}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-[#ffffff] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submittingQuote && <Loader2 className="w-4 h-4 animate-spin" />}
                    Envoyer la demande
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
