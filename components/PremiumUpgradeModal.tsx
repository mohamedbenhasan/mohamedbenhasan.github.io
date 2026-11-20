import React from 'react';
import { ShieldAlert, Sparkles, Users, Lock, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import { FeatureKey, SubscriptionPlan } from '../types';
import { formatPrice, getPlanPrice, getRequiredPlanForFeature } from '../utils/subscriptionPlans';
import { useAuth } from '../AuthContext';

interface Props {
  feature: FeatureKey | null;
  onClose: () => void;
  onViewPricing: (highlightPlan?: SubscriptionPlan) => void;
}

const FEATURE_TITLES: Partial<Record<FeatureKey, string>> = {
  sos: 'Bouton & Alertes SOS',
  emergency_contacts: 'Contacts d’urgence',
  auto_emergency_alerts: 'Alertes automatiques d’urgence',
  realtime_location_sharing: 'Partage de localisation en temps réel',
  safety_history: 'Historique avancé & Exports CSV/PDF',
  smart_localization: 'Localisation intelligente & TERIA',
  smart_navigation: 'Navigation sécurisée, PMR & Guidage audio',
  custom_alerts: 'Alertes personnalisées & Console V2X',
  advanced_stats: 'Statistiques avancées & Analyse IA',
  global_risk_heatmap: 'Global Incident & Risk Heatmap',
  family_profiles: 'Profils familiaux (jusqu’à 6 membres)',
  family_management: 'Gestion centralisée de la famille',
  family_location_sharing: 'Partage de localisation familial',
  family_emergency_contacts: 'Contacts d’urgence familiaux partagés',
  family_safety_alerts: 'Alertes de sécurité familiales',
  family_dashboard: 'Tableau de bord familial & Suivi parental',
  family_member_settings: 'Paramètres de sécurité des membres',
  business_fleet: 'Gestion de flotte & équipes',
  business_api: 'API Professionnelle Business',
};

export const PremiumUpgradeModal: React.FC<Props> = ({ feature, onClose, onViewPricing }) => {
  const { currency, publicConfig } = useAuth();
  if (!feature) return null;

  const requiredPlan = getRequiredPlanForFeature(feature);
  const featureTitle = FEATURE_TITLES[feature] || 'Fonctionnalité avancée';
  const isFamilyFeature = requiredPlan === 'FAMILY';
  const targetMonthly = formatPrice(
    getPlanPrice(isFamilyFeature ? 'FAMILY' : 'PREMIUM', 'monthly', currency, publicConfig),
    currency
  );
  const targetAnnual = formatPrice(
    getPlanPrice(isFamilyFeature ? 'FAMILY' : 'PREMIUM', 'annual', currency, publicConfig),
    currency
  );
  const familyMonthly = formatPrice(
    getPlanPrice('FAMILY', 'monthly', currency, publicConfig),
    currency
  );

  return (
    <div
      className="fixed inset-0 z-[120000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center border ${
                isFamilyFeature
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                  : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
              }`}
            >
              {isFamilyFeature ? <Users className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {isFamilyFeature ? 'VruGuard Family' : 'VruGuard Premium'}
              </div>
              <h2 id="upgrade-modal-title" className="font-display text-lg font-bold text-white leading-tight">
                {featureTitle}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            Cette fonctionnalité est disponible avec VruGuard Premium. Passez à Premium pour bénéficier du SOS, gérer vos contacts d&apos;urgence et profiter d&apos;une protection avancée.
          </p>

          {isFamilyFeature && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
              <Users className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Inclus dans VruGuard Family ({familyMonthly}/mois) :</span>{' '}
                jusqu&apos;à 6 profils familiaux, suivi parental en temps réel et paramètres de sécurité par membre.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-800 rounded-lg px-3 py-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>SOS rapide &amp; vocal</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-800 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Jusqu&apos;à 10 contacts d&apos;urgence</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-800 rounded-lg px-3 py-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Fusion multi-capteurs &amp; IA</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-800 rounded-lg px-3 py-2">
              <Users className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Partage GPS temps réel</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>
              {isFamilyFeature
                ? `VruGuard Family dès ${targetMonthly}/mois`
                : `VruGuard Premium dès ${targetMonthly}/mois`}
            </span>
            <span className="font-mono tabular-nums text-emerald-400">
              {targetAnnual}/an
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              onClose();
              onViewPricing(requiredPlan);
            }}
            className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
          >
            Découvrir Premium
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onClose();
              onViewPricing();
            }}
            className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-xl border border-slate-700 transition-colors"
          >
            Voir les abonnements
          </button>
        </div>
      </div>
    </div>
  );
};
