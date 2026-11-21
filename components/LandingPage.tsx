import React, { useState } from 'react';
import {
  ArrowRight,
  MapPin,
  Navigation,
  Siren,
  Users,
  BellRing,
  Share2,
  ShieldCheck,
  Check,
  X,
  ChevronDown,
  Ticket,
  Sparkles,
  Building2,
  Menu,
  Lock,
  Mail,
  Smartphone,
} from 'lucide-react';
import { BillingCycle, SubscriptionPlan } from '../types';
import {
  formatPrice,
  getPlanPrice,
  isPlanActiveInCatalog,
  SUBSCRIPTION_PLANS,
} from '../utils/subscriptionPlans';
import { useAuth } from '../AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { CurrencySelector } from './CurrencySelector';
import { VruLogo } from './VruLogo';

import heroMobilityImg from '../src/assets/images/hero_vruguard_mobility_1794998116506.jpg';
import urbanLocalizationImg from '../src/assets/images/feature_urban_localization_1794998116343.jpg';
import familyProtectionImg from '../src/assets/images/feature_family_protection_1794998116911.jpg';

interface LandingPageProps {
  isAuthenticated: boolean;
  userName?: string;
  userPlan?: SubscriptionPlan;
  onLaunch: () => void;
  onOpenPricing: (highlightPlan?: SubscriptionPlan) => void;
  onOpenDownload?: () => void;
  onOpenProfile?: () => void;
  onOpenHistory?: () => void;
}

interface FaqItem {
  question: string;
  answer: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  isAuthenticated,
  userName,
  userPlan,
  onLaunch,
  onOpenPricing,
  onOpenDownload,
  onOpenProfile,
  onOpenHistory,
}) => {
  const { currency, publicConfig } = useAuth();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  const freeMonthlyStr = formatPrice(getPlanPrice('FREE', 'monthly', currency, publicConfig), currency);
  const premMonthlyStr = formatPrice(getPlanPrice('PREMIUM', 'monthly', currency, publicConfig), currency);
  const famMonthlyStr = formatPrice(getPlanPrice('FAMILY', 'monthly', currency, publicConfig), currency);
  const famAnnualStr = formatPrice(getPlanPrice('FAMILY', 'annual', currency, publicConfig), currency);

  const faqItems: FaqItem[] = [
    {
      question: "Qu'est-ce que VruGuard ?",
      answer:
        "VruGuard est une plateforme SaaS de sécurité connectée dédiée aux piétons, cyclistes, utilisateurs de trottinettes et usagers vulnérables (VRU). Elle réunit la localisation intelligente, la navigation adaptée, les alertes de sécurité routière, la protection familiale et l'assistance d'urgence.",
    },
    {
      question: 'Comment créer un compte ?',
      answer:
        'Cliquez sur « Commencer gratuitement », puis inscrivez-vous en moins d’une minute avec votre adresse e-mail ou votre compte Google. Votre espace Free est immédiatement actif et vous permet d’accéder à la carte et aux fonctions de base.',
    },
    {
      question: 'Quelle est la différence entre Free et Premium ?',
      answer:
        `L’offre Free (${freeMonthlyStr}/mois) inclut le compte utilisateur, la localisation GPS de base, l’accès à la carte, la navigation de base et les informations routières. VruGuard Premium (${premMonthlyStr}/mois) débloque le bouton et les alertes SOS, les contacts d’urgence (jusqu’à 10), les alertes automatiques, le partage de localisation en temps réel, la localisation intelligente multi-sources et la navigation avancée.`,
    },
    {
      question: 'Comment fonctionne le SOS ?',
      answer:
        'Disponible exclusivement pour les abonnés Premium et Family, le bouton SOS permet de déclencher une alerte d’urgence en un geste ou par commande vocale, de transmettre automatiquement votre position exacte et de prévenir vos contacts d’urgence configurés.',
    },
    {
      question: 'Comment activer un abonnement avec un code Redeem ?',
      answer:
        'Rendez-vous dans la page Abonnements ou dans votre tableau de bord personnel, saisissez le code Redeem fourni par l’administration VruGuard (ex. VRU-PREM-XXXX-XXXX) et validez. Votre formule Premium ou Family est activée instantanément avec ses dates de validité visibles dans votre historique.',
    },
    {
      question: "Comment fonctionne l'offre Family ?",
      answer:
        `VruGuard Family (${famMonthlyStr}/mois ou ${famAnnualStr}/an) étend tous les avantages Premium à 6 profils familiaux. Elle inclut le suivi familial en temps réel, le partage de contacts d’urgence familiaux, les alertes automatiques pour les proches et un tableau de bord centralisé.`,
    },
    {
      question: 'Comment contacter le support ?',
      answer:
        'Vous pouvez écrire à notre équipe à support@vruguard.me pour toute demande d’assistance, de code Redeem ou d’accompagnement Business. Les demandes d’offres entreprises peuvent également être envoyées directement depuis le formulaire Devis Business.',
    },
  ];

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden">
      {/* Top Bar — strictly 3 zones */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 shrink-0 text-left focus:outline-none"
          >
            <VruLogo className="w-8 h-8 rounded-lg" />
            <span className="font-display font-bold text-lg tracking-tight text-white whitespace-nowrap">
              VruGuard
            </span>
          </button>

          {/* Zone 2: Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
            <button
              onClick={() => scrollToSection('features')}
              className="whitespace-nowrap hover:text-white transition-colors"
            >
              Fonctionnalités
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="whitespace-nowrap hover:text-white transition-colors"
            >
              Comment ça marche
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="whitespace-nowrap hover:text-white transition-colors"
            >
              Tarifs
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="whitespace-nowrap hover:text-white transition-colors"
            >
              FAQ
            </button>
            {isAuthenticated && onOpenDownload && (
              <a
                href="/download"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenDownload();
                }}
                className="whitespace-nowrap text-blue-400 hover:text-blue-300 transition-colors"
              >
                App Android
              </a>
            )}
          </nav>

          {/* Zone 3: Single Primary Action + Compact utility controls */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {isAuthenticated && onOpenProfile && (
              <button
                onClick={onOpenProfile}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap"
              >
                Mon espace {userPlan ? `· ${userPlan}` : ''}
              </button>
            )}

            <button
              onClick={isAuthenticated ? onLaunch : onOpenDownload || onLaunch}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold transition-colors whitespace-nowrap flex items-center gap-2 shadow-sm shadow-blue-600/20"
            >
              {isAuthenticated ? (
                <>
                  <span>Ouvrir l’application</span>
                  <ArrowRight className="w-4 h-4 hidden sm:inline" />
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 hidden sm:inline" />
                  <span>App Android</span>
                </>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg border border-slate-800 text-slate-300 hover:text-white"
              aria-label="Menu de navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800 bg-slate-950 px-4 py-4 space-y-2">
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              Fonctionnalités
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              Comment ça marche
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              Tarifs
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
            >
              FAQ
            </button>
            {isAuthenticated && onOpenDownload && (
              <a
                href="/download"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  onOpenDownload();
                }}
                className="block w-full text-left py-2 text-sm font-medium text-blue-400 hover:text-blue-300"
              >
                App Android
              </a>
            )}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <ThemeToggle showLabel={true} />
              {isAuthenticated && onOpenProfile && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="text-xs font-semibold text-blue-400"
                >
                  Mon espace
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative border-b border-slate-800/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Hero Copy */}
              <div className="lg:col-span-6 space-y-6 animate-fade-up">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                  Mobilité connectée · Protection VRU
                </p>

                <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.35rem] font-extrabold tracking-tight text-white leading-[1.08]">
                  Votre sécurité, intelligemment connectée.
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                  VruGuard vous accompagne avec des technologies intelligentes de localisation, de navigation et de protection pour vous aider à rester connecté et en sécurité.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                  <button
                    onClick={onLaunch}
                    className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                  >
                    <span>{isAuthenticated ? 'Accéder au tableau de bord' : 'Commencer gratuitement'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onOpenPricing('PREMIUM')}
                    className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-semibold text-sm sm:text-base transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span>Découvrir Premium</span>
                  </button>
                </div>

                {/* Quiet secondary links bar */}
                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                  <button
                    onClick={() => onOpenPricing()}
                    className="hover:text-white transition-colors inline-flex items-center gap-1.5 font-medium"
                  >
                    <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                    Activer un code Redeem
                  </button>
                  {isAuthenticated && onOpenHistory && (
                    <>
                      <span className="text-slate-600">·</span>
                      <button
                        onClick={onOpenHistory}
                        className="hover:text-white transition-colors font-medium"
                      >
                        Historique ({userName || 'Compte'})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Hero Visual Showcase */}
              <div className="lg:col-span-6 animate-fade-up" style={{ animationDelay: '0.08s' }}>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl">
                  <img
                    src={heroMobilityImg}
                    alt="Mobilité urbaine connectée VruGuard pour cyclistes et piétons"
                    className="w-full aspect-[16/10] object-cover object-center"
                  />
                  <div className="p-5 sm:p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                        Couverture active des trajets
                      </div>
                      <p className="text-sm text-slate-200 mt-1">
                        Carte interactive gratuite · Alertes &amp; assistance SOS pour les abonnés Premium et Family.
                      </p>
                    </div>
                    <button
                      onClick={() => scrollToSection('pricing')}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap shrink-0 flex items-center gap-1"
                    >
                      Comparer les plans <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRÉSENTATION — PROBLÈME & SOLUTION */}
        <section className="py-16 sm:py-24 border-b border-slate-800/70 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-5 order-2 lg:order-1">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
                  <img
                    src={urbanLocalizationImg}
                    alt="Modélisation de localisation intelligente en environnement urbain dense"
                    className="w-full aspect-[4/3] object-cover"
                  />
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6 order-1 lg:order-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                  Pourquoi VruGuard
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                  Transformer chaque trajet vulnérable en déplacement maîtrisé
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Le constat sur le terrain
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      En milieu urbain, les piétons, cyclistes et usagers à mobilité douce subissent des angles morts, une précision GPS dégradée par les bâtiments et l’absence de mécanisme d’alerte rapide vers leurs proches en cas d’incident.
                    </p>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900 border border-blue-500/30 space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      La réponse VruGuard
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      Une plateforme unifiée combinant cartographie temps réel, fusion multi-sources pour fiabiliser la position, guidage adapté et dispositif complet SOS, contacts d’urgence et protection familiale.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FONCTIONNALITÉS — 7 REAL IMPLEMENTED CAPABILITIES */}
        <section id="features" className="py-16 sm:py-24 border-b border-slate-800/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Fonctionnalités de la plateforme
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Des outils concrets, pensés pour la sécurité au quotidien
              </h2>
              <p className="text-slate-400 text-base">
                Accédez gratuitement aux fonctions essentielles de carte et de navigation, puis débloquez l’assistance d’urgence et le suivi familial avec Premium ou Family.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Localisation intelligente
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Suivi GPS de base dès le plan Free, et estimation d’incertitude multi-capteurs (GNSS, TERIA, inertiel et coopératif) avec l’abonnement Premium.
                  </p>
                </div>
                <div className="text-xs font-medium text-slate-400 pt-3 border-t border-slate-800">
                  Free (GPS de base) · Premium &amp; Family (Multi-sources)
                </div>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Navigation adaptée
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Accès à la carte et calcul d’itinéraire standard inclus gratuitement, complétés par le routage sécurisé, le guidage vocal mains libres et les critères PMR en Premium.
                  </p>
                </div>
                <div className="text-xs font-medium text-slate-400 pt-3 border-t border-slate-800">
                  Free (Carte &amp; base) · Premium &amp; Family (Sécurisée)
                </div>
              </div>

              {/* Feature 3 — SOS (Premium/Family only) */}
              <div className="rounded-2xl bg-slate-900 border border-red-500/30 p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                      <Siren className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-300">
                      <Lock className="w-3 h-3" /> Réservé Premium &amp; Family
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">
                    SOS et assistance d&apos;urgence
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Déclenchement d’alerte SOS rapide en un geste ou par commande vocale, avec enregistrement automatique du contexte et notification immédiate des proches.
                  </p>
                </div>
                <div className="text-xs font-medium text-red-300/90 pt-3 border-t border-slate-800">
                  Non disponible sur l’offre Free
                </div>
              </div>

              {/* Feature 4 — Emergency Contacts (Premium/Family only) */}
              <div className="rounded-2xl bg-slate-900 border border-blue-500/30 p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-300">
                      <Lock className="w-3 h-3" /> Réservé Premium &amp; Family
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Contacts d&apos;urgence
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Ajoutez et gérez jusqu’à 10 personnes de confiance alertées automatiquement lors d’un SOS ou d’une situation critique détectée sur votre trajet.
                  </p>
                </div>
                <div className="text-xs font-medium text-blue-300/90 pt-3 border-t border-slate-800">
                  Non disponible sur l’offre Free
                </div>
              </div>

              {/* Feature 5 */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <BellRing className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Alertes de sécurité
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Consultez les informations routières dès le plan Free, et activez les alertes personnalisées de zones à risque et messages V2X en Premium.
                  </p>
                </div>
                <div className="text-xs font-medium text-slate-400 pt-3 border-t border-slate-800">
                  Free (Infos routières) · Premium &amp; Family (Alertes avancées)
                </div>
              </div>

              {/* Feature 6 */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Partage de localisation
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Générez un lien sécurisé temporaire pour permettre à vos proches de suivre votre progression en direct durant un déplacement sensible ou nocturne.
                  </p>
                </div>
                <div className="text-xs font-medium text-indigo-300/90 pt-3 border-t border-slate-800">
                  Inclus dans Premium &amp; Family
                </div>
              </div>
            </div>

            {/* Feature 7 — Family Protection Wide Spotlight */}
            <div className="rounded-2xl bg-slate-900 border border-indigo-500/35 overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-center">
              <div className="lg:col-span-7 p-6 sm:p-10 space-y-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-400">
                  VruGuard Family · Jusqu&apos;à 6 membres
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Protection familiale centralisée
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Conçue pour les parents, enfants et proches vulnérables : suivez les trajets familiaux sur un tableau de bord unifié, partagez les contacts d’urgence du foyer et personnalisez les seuils d’alerte pour chaque membre.
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" /> Jusqu&apos;à 6 profils familiaux
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" /> Suivi parental temps réel
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" /> Contacts &amp; SOS partagés
                  </span>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => onOpenPricing('FAMILY')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[#ffffff] text-sm font-semibold transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Découvrir l&apos;offre Family
                  </button>
                </div>
              </div>
              <div className="lg:col-span-5 h-full">
                <img
                  src={familyProtectionImg}
                  alt="Protection familiale VruGuard pour trajets à vélo en famille"
                  className="w-full h-full min-h-[240px] max-h-[360px] object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* COMMENT ÇA MARCHE — 3 STEPS */}
        <section id="how-it-works" className="py-16 sm:py-24 border-b border-slate-800/70 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Comment ça marche ?
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Opérationnel en trois étapes simples
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
                <div className="font-mono text-sm font-bold text-blue-400 tabular-nums">01</div>
                <h3 className="font-display text-xl font-bold text-white">
                  Créez votre compte
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Inscrivez-vous gratuitement en quelques secondes. Vous accédez aussitôt à la carte VruGuard, au suivi GPS de base et aux informations routières.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
                <div className="font-mono text-sm font-bold text-blue-400 tabular-nums">02</div>
                <h3 className="font-display text-xl font-bold text-white">
                  Choisissez votre formule
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Comparez les offres Free, Premium (individuelle avec SOS et contacts d’urgence) et Family (jusqu’à 6 profils) selon votre besoin de protection.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-blue-500/30 p-6 space-y-4">
                <div className="font-mono text-sm font-bold text-emerald-400 tabular-nums">03</div>
                <h3 className="font-display text-xl font-bold text-white">
                  Activez votre abonnement
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Saisissez votre <strong className="text-white">code Redeem</strong> fourni par l’équipe VruGuard dans votre espace personnel pour débloquer immédiatement toutes les fonctionnalités de votre offre.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* TARIFICATION — 4 PLANS MULTIDEVISES */}
        <section id="pricing" className="py-16 sm:py-24 border-b border-slate-800/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                  Tarification transparente
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  Des formules adaptées à chaque usager
                </h2>
                <p className="text-slate-400 text-sm sm:text-base">
                  Le SOS et la gestion des contacts d&apos;urgence sont exclusivement inclus dans les offres Premium, Family et Business.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-start">
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
                    <span className="font-mono text-[10px] text-emerald-400">-17%</span>
                  </button>
                </div>

                <CurrencySelector />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const isRecommended = Boolean(plan.recommended);
                const planEnabled = isPlanActiveInCatalog(plan.id, publicConfig);
                const monthlyPrice = getPlanPrice(plan.id, 'monthly', currency, publicConfig);
                const annualPrice = getPlanPrice(plan.id, 'annual', currency, publicConfig);
                const price = billingCycle === 'annual' ? annualPrice : monthlyPrice;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-6 flex flex-col justify-between transition-colors ${
                      !planEnabled
                        ? 'bg-slate-900/40 border-slate-800/70 opacity-75'
                        : isRecommended
                        ? 'bg-slate-900 border-blue-500 shadow-xl shadow-blue-950/30'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                          {plan.id === 'PREMIUM' && <Sparkles className="w-4 h-4 text-blue-400" />}
                          {plan.id === 'FAMILY' && <Users className="w-4 h-4 text-indigo-400" />}
                          {plan.id === 'BUSINESS' && <Building2 className="w-4 h-4 text-emerald-400" />}
                          {plan.name}
                        </h3>
                        {!planEnabled ? (
                          <span className="text-[11px] font-semibold text-amber-400">
                            Désactivé
                          </span>
                        ) : plan.badge ? (
                          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                            {plan.badge}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-xs text-slate-400 min-h-[36px] mb-5">{plan.tagline}</p>

                      <div className="pb-5 mb-5 border-b border-slate-800 tabular-nums">
                        {price !== null ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-display text-3xl font-bold text-white">
                              {formatPrice(price, currency)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {billingCycle === 'annual' && price > 0 ? '/an' : '/mois'}
                            </span>
                          </div>
                        ) : (
                          <div className="font-display text-2xl font-bold text-white">
                            Sur devis
                          </div>
                        )}
                        {monthlyPrice !== null &&
                          annualPrice !== null &&
                          monthlyPrice > 0 && (
                            <div className="text-[11px] font-mono text-slate-400 mt-1">
                              {billingCycle === 'monthly'
                                ? `Ou ${formatPrice(annualPrice, currency)}/an`
                                : `Soit ${formatPrice(Math.round((annualPrice / 12) * 100) / 100, currency)}/mois`}
                            </div>
                          )}
                      </div>

                      <button
                        disabled={!planEnabled}
                        onClick={() => {
                          if (!planEnabled) return;
                          if (plan.id === 'FREE') {
                            onLaunch();
                          } else {
                            onOpenPricing(plan.id);
                          }
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors mb-6 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          !planEnabled
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : plan.id === 'PREMIUM'
                            ? 'bg-blue-600 hover:bg-blue-500 text-[#ffffff]'
                            : plan.id === 'FAMILY'
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-[#ffffff]'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                        }`}
                      >
                        {!planEnabled
                          ? 'Indisponible'
                          : plan.id === 'FREE'
                          ? 'Commencer gratuitement'
                          : plan.id === 'BUSINESS'
                          ? 'Demander un devis'
                          : `Choisir ${plan.name}`}
                      </button>

                      <div className="space-y-2.5">
                        {plan.featuresIncluded.map((feat) => (
                          <div key={feat} className="flex items-start gap-2 text-xs text-slate-200">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                        {plan.featuresExcluded?.map((feat) => (
                          <div key={feat} className="flex items-start gap-2 text-xs text-slate-500">
                            <X className="w-4 h-4 text-red-400/70 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs sm:text-sm text-slate-300">
              <div className="flex items-start sm:items-center gap-3">
                <Ticket className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong className="text-white">Activation par code Redeem :</strong> le paiement en ligne n’est pas encore requis. Utilisez votre code d’activation pour passer instantanément à Premium ou Family.
                </span>
              </div>
              <button
                onClick={() => onOpenPricing('PREMIUM')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold whitespace-nowrap border border-slate-700"
              >
                J&apos;ai un code Redeem
              </button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 sm:py-24 border-b border-slate-800/70 bg-slate-900/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="space-y-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Questions fréquentes
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Tout savoir sur VruGuard
              </h2>
            </div>

            <div className="space-y-3">
              {faqItems.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={item.question}
                    className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm sm:text-base font-semibold text-white hover:bg-slate-800/40 transition-colors"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm text-slate-300 leading-relaxed border-t border-slate-800/70 pt-3">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-slate-800/80">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <VruLogo className="w-7 h-7 rounded-lg" />
                <span className="font-display font-bold text-base text-white">VruGuard</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plateforme de mobilité connectée pour piétons, cyclistes et familles : localisation, navigation et protection en temps réel.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Navigation
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">
                    Fonctionnalités
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors">
                    Comment ça marche
                  </button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors">
                    Questions fréquentes
                  </button>
                </li>
                {onOpenDownload && (
                  <li>
                    <a
                      href="/download"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenDownload();
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Télécharger l&apos;APK Android
                    </a>
                  </li>
                )}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Abonnements
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <button onClick={() => onOpenPricing('FREE')} className="hover:text-white transition-colors tabular-nums">
                    Offre Free ({freeMonthlyStr}/mois)
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenPricing('PREMIUM')} className="hover:text-white transition-colors tabular-nums">
                    VruGuard Premium ({premMonthlyStr}/mois)
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenPricing('FAMILY')} className="hover:text-white transition-colors tabular-nums">
                    VruGuard Family ({famMonthlyStr}/mois)
                  </button>
                </li>
                <li>
                  <button onClick={() => onOpenPricing('BUSINESS')} className="hover:text-white transition-colors">
                    Business (Sur devis)
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Support &amp; Légal
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <a
                    href="mailto:support@vruguard.me"
                    className="hover:text-white transition-colors inline-flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    support@vruguard.me
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => setLegalModal('privacy')}
                    className="hover:text-white transition-colors"
                  >
                    Politique de confidentialité
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setLegalModal('terms')}
                    className="hover:text-white transition-colors"
                  >
                    Conditions d&apos;utilisation
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} VruGuard (vruguard.me). Tous droits réservés.</span>
            <span>Localisation intelligente · Navigation · Protection VRU</span>
          </div>
        </div>
      </footer>

      {/* Legal Modal */}
      {legalModal && (
        <div
          className="fixed inset-0 z-[120000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display text-lg font-bold text-white">
                {legalModal === 'privacy'
                  ? 'Politique de confidentialité VruGuard'
                  : "Conditions d'utilisation VruGuard"}
              </h3>
              <button
                onClick={() => setLegalModal(null)}
                className="p-1 text-slate-400 hover:text-white"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {legalModal === 'privacy' ? (
              <div className="text-xs sm:text-sm text-slate-300 space-y-2.5 leading-relaxed">
                <p>
                  VruGuard traite uniquement les données de compte et de géolocalisation nécessaires au fonctionnement de la carte, de la navigation et des fonctions de sécurité activées par votre abonnement.
                </p>
                <p>
                  Les contacts d’urgence et le partage de localisation en direct sont exclusivement utilisés à votre initiative ou lors d’un déclenchement SOS réservé aux offres Premium et Family.
                </p>
              </div>
            ) : (
              <div className="text-xs sm:text-sm text-slate-300 space-y-2.5 leading-relaxed">
                <p>
                  L’accès Free comprend la gestion de compte, la localisation GPS de base, la carte, la navigation standard et les informations routières.
                </p>
                <p>
                  Les fonctionnalités SOS, contacts d’urgence, alertes automatiques et profils familiaux nécessitent un abonnement Premium, Family ou Business actif, activable notamment via un code Redeem officiel.
                </p>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
