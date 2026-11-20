import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  FileText,
  Lock,
  MapPin,
  Bell,
  Database,
  Globe,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  LogOut,
  Smartphone,
  Monitor,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import {
  CLIENT_CONSENT_VERSION,
  CLIENT_PRIVACY_VERSION,
  CLIENT_TERMS_VERSION,
  detectConsentPlatform,
} from '../services/ConsentService';
import { toast } from '../services/NotificationService';

type LegalDocView = null | 'terms' | 'privacy';

interface Props {
  onLogout: () => Promise<void>;
}

const CONSENT_SECTIONS = [
  {
    id: 'terms',
    icon: FileText,
    title: '1. Conditions Générales d’Utilisation (CGU)',
    summary:
      'Votre utilisation de VRU Guard Sentinel (formule Free, Premium, Family ou Business) est encadrée par nos CGU : règles d’usage responsable de la navigation, périmètre des alertes VRU et fonctionnement des abonnements ou codes Redeem.',
  },
  {
    id: 'privacy',
    icon: Lock,
    title: '2. Politique de confidentialité & données personnelles',
    summary:
      'Nous traitons exclusivement les données nécessaires à votre sécurité et à votre compte : identifiant Firebase (UID), adresse e-mail, nom d’affichage, profil d’usager vulnérable (VRU) et historique des trajets enregistrés.',
  },
  {
    id: 'location',
    icon: MapPin,
    title: '3. Données de localisation et capteurs',
    summary:
      'Votre position GPS (localisation précise ou approximative sur Web et Android) sert à afficher la carte, calculer vos itinéraires et détecter les zones à risque. Ces données ne sont collectées que lorsque l’application est utilisée et autorisée par votre appareil.',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: '4. Fonctionnement des notifications et alertes',
    summary:
      'La plateforme émet des alertes de proximité routière (V2X/DENM), des notifications d’administration ou de sécurité, ainsi que les alertes SOS vers vos contacts de confiance lorsque cette option est activée.',
  },
  {
    id: 'services',
    icon: Database,
    title: '5. Données nécessaires au fonctionnement des services',
    summary:
      'Vos contacts d’urgence, vos profils familiaux (offre Family) et les informations liées à votre abonnement sont conservés de manière sécurisée afin de synchroniser votre protection sur tous vos appareils.',
  },
  {
    id: 'third-party',
    icon: Globe,
    title: '6. Échanges avec des services techniques tiers indispensables',
    summary:
      'Pour fonctionner, VRU Guard Sentinel communique avec Firebase (authentification et base de données), OpenStreetMap / Overpass / OSRM (données cartographiques et itinéraires), Stripe ou Konnect uniquement lors d’un paiement volontaire, et notre passerelle vocale/IA uniquement sur action explicite.',
  },
  {
    id: 'rights',
    icon: UserCheck,
    title: '7. Vos droits (accès, rectification et retrait)',
    summary:
      'Conformément au RGPD, vous conservez le contrôle complet sur vos données : consultation de la preuve d’acceptation, modification de vos consentements facultatifs et rétractation possible à tout moment depuis votre profil.',
  },
];

export const FirstConsentModal: React.FC<Props> = ({ onLogout }) => {
  const {
    user,
    consentStatus,
    acceptUserConsent,
    refuseUserConsent,
    refreshConsentStatus,
  } = useAuth();

  const platform = detectConsentPlatform();

  // Strictly unchecked by default per legal & UX requirement
  const [acceptedRequired, setAcceptedRequired] = useState(false);
  const [optNotifications, setOptNotifications] = useState(false);
  const [optLocationEnhancements, setOptLocationEnhancements] = useState(false);

  const [submittingAccept, setSubmittingAccept] = useState(false);
  const [submittingRefuse, setSubmittingRefuse] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refusedScreen, setRefusedScreen] = useState<boolean>(
    consentStatus?.consentStatus === 'refused' || consentStatus?.consentStatus === 'withdrawn'
  );
  const [legalDoc, setLegalDoc] = useState<LegalDocView>(null);

  useEffect(() => {
    if (
      consentStatus?.consentStatus === 'refused' ||
      consentStatus?.consentStatus === 'withdrawn'
    ) {
      setRefusedScreen(true);
    }
  }, [consentStatus?.consentStatus]);

  // Trap Escape key so modal cannot be bypassed by keyboard dismissal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (legalDoc) {
          e.preventDefault();
          e.stopPropagation();
          setLegalDoc(null);
        } else {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [legalDoc]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedRequired || submittingAccept || submittingRefuse) return;

    setErrorMessage(null);
    setSubmittingAccept(true);
    try {
      const updated = await acceptUserConsent({
        acceptedRequired: true,
        optionalConsents: {
          notifications: optNotifications,
          locationEnhancements: optLocationEnhancements,
        },
      });
      if (!updated.accessAllowed) {
        await refreshConsentStatus();
        throw new Error(
          'La confirmation serveur du consentement n’a pas encore été validée. Veuillez réessayer.'
        );
      }
      toast.success('Consentement enregistré. Bienvenue sur VRU Guard Sentinel.');
    } catch (err: any) {
      const msg =
        err?.message ||
        'Impossible d’enregistrer votre consentement. Vérifiez votre connexion internet et réessayez.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmittingAccept(false);
    }
  };

  const handleRefuse = async () => {
    if (submittingAccept || submittingRefuse) return;
    setErrorMessage(null);
    setSubmittingRefuse(true);
    try {
      await refuseUserConsent();
      setRefusedScreen(true);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Erreur réseau lors de l’enregistrement du refus. Veuillez réessayer.'
      );
      setRefusedScreen(true);
    } finally {
      setSubmittingRefuse(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140000] bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vru-consent-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <header className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-blue-400 mb-1">
                <span>Consentement obligatoire · v{CLIENT_CONSENT_VERSION}</span>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  {platform === 'android' ? (
                    <>
                      <Smartphone className="w-3 h-3" /> Android
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3 h-3" /> Web
                    </>
                  )}
                </span>
              </div>
              <h1
                id="vru-consent-title"
                className="font-display text-lg sm:text-xl font-bold text-white leading-tight"
              >
                Bienvenue sur VRU Guard Sentinel
              </h1>
              {user?.email && (
                <p className="text-xs font-mono text-slate-400 truncate mt-0.5">
                  Compte : {user.email}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Sub-view: Full Legal Document Reader OR Refusal Screen OR Main Consent Form */}
        {legalDoc ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 sm:px-7 py-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setLegalDoc(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Revenir au résumé de consentement
              </button>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                Version {legalDoc === 'terms' ? CLIENT_TERMS_VERSION : CLIENT_PRIVACY_VERSION}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {legalDoc === 'terms' ? (
                <>
                  <h2 className="font-display text-base sm:text-lg font-bold text-white">
                    Conditions Générales d’Utilisation — VRU Guard Sentinel (v{CLIENT_TERMS_VERSION})
                  </h2>
                  <p>
                    1. <strong>Objet du service :</strong> VRU Guard Sentinel propose des outils d’assistance à la mobilité, de cartographie interactive, de signalement d’alertes VRU et, selon votre formule d’abonnement, des fonctions de protection SOS, contacts d’urgence et suivi familial.
                  </p>
                  <p>
                    2. <strong>Aide à la vigilance uniquement :</strong> Les alertes de proximité, calculs d’itinéraires et informations routières constituent une aide complémentaire et ne remplacent jamais le respect du Code de la route ni votre vigilance directe sur la voie publique.
                  </p>
                  <p>
                    3. <strong>Accès Free &amp; formules payantes :</strong> L’accès Free inclut la localisation GPS de base, la carte, la navigation standard et la gestion du compte. Les fonctionnalités avancées (SOS, contacts de confiance, suivi familial Family, localisation multi-capteurs avancée) requièrent un abonnement actif (paiement vérifié, programme Pioneer, programme Accessibilité ou code Redeem officiel).
                  </p>
                  <p>
                    4. <strong>Sécurité du compte :</strong> Votre compte Firebase personnel est strictement individuel. L’administration se réserve le droit de suspendre ou restreindre tout accès en cas d’usage frauduleux ou de compromission manifeste de sécurité.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-base sm:text-lg font-bold text-white">
                    Politique de Confidentialité — VRU Guard Sentinel (v{CLIENT_PRIVACY_VERSION})
                  </h2>
                  <p>
                    1. <strong>Données collectées :</strong> Lorsque vous utilisez votre compte, VRU Guard Sentinel traite vos données d’identification (UID Firebase, e-mail, nom d’affichage), votre statut d’abonnement, vos enregistrements de trajets/sessions et votre preuve horodatée de consentement.
                  </p>
                  <p>
                    2. <strong>Données de géolocalisation :</strong> Sur navigateur Web et application Android native, la localisation GPS est utilisée uniquement lorsque la fonctionnalité cartographique, le guidage ou le partage d’urgence est actif et autorisé par les permissions système de votre appareil.
                  </p>
                  <p>
                    3. <strong>Sous-traitants techniques :</strong> L’authentification et le stockage utilisateur reposent sur Google Firebase ; le fonds de carte et le calcul d’itinéraire exploitent OpenStreetMap / Overpass / OSRM ; les paiements éventuels passent par Stripe ou Konnect sans conservation de vos numéros de carte sur nos serveurs.
                  </p>
                  <p>
                    4. <strong>Vos droits RGPD :</strong> Vous disposez d’un droit d’accès, de rectification, de suppression de compte et de retrait de vos consentements facultatifs (ou retrait global) directement depuis votre espace profil ou via le support VruGuard.
                  </p>
                </>
              )}
            </div>

            <div className="px-5 sm:px-7 py-4 border-t border-slate-800 bg-slate-950/70 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setLegalDoc(null)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold transition-colors"
              >
                Fermer et revenir
              </button>
            </div>
          </div>
        ) : refusedScreen ? (
          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-8 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="max-w-lg space-y-3">
              <h2 className="font-display text-xl font-bold text-white">
                Accès bloqué tant que le consentement n’est pas accepté
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Conformément à nos engagements de transparence et de protection des données, VRU Guard Sentinel ne peut pas activer votre espace utilisateur, votre localisation, vos alertes ni vos abonnements sans votre acceptation explicite des Conditions Générales d’Utilisation et de la Politique de Confidentialité.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aucune donnée de trajet ou d’alerte n’est exploitée tant que vous n’avez pas donné votre accord. Vous pouvez relire les informations détaillées ou vous déconnecter de ce compte.
              </p>
            </div>

            {errorMessage && (
              <div className="max-w-lg w-full p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full max-w-md pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setRefusedScreen(false);
                }}
                className="flex-1 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Consulter les informations
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loggingOut}
                className="flex-1 px-5 py-3 rounded-xl bg-slate-800 hover:bg-red-950/60 border border-slate-700 hover:border-red-500/40 text-slate-200 hover:text-red-200 text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Se déconnecter
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAccept} className="flex-1 flex flex-col min-h-0">
            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5">
              {/* Required Intro Paragraph */}
              <div className="p-4 rounded-xl bg-blue-950/35 border border-blue-500/30 text-xs sm:text-sm text-slate-200 leading-relaxed">
                Avant de commencer à utiliser VRU Guard Sentinel, nous vous invitons à prendre connaissance des informations relatives à l&apos;utilisation de notre plateforme et à donner votre consentement. Votre accord est nécessaire pour accéder aux fonctionnalités de l&apos;application.
              </div>

              {/* 7 Factual Information Sections */}
              <div className="grid grid-cols-1 gap-3">
                {CONSENT_SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <div
                      key={sec.id}
                      className="p-3.5 sm:p-4 rounded-xl bg-slate-950/60 border border-slate-800/90 flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h2 className="font-display text-xs sm:text-sm font-bold text-white">
                          {sec.title}
                        </h2>
                        <p className="text-xs text-slate-300 leading-relaxed">{sec.summary}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Direct Legal Document Links */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setLegalDoc('terms')}
                  className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-blue-400 inline-flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Lire les Conditions Générales d’Utilisation (v{CLIENT_TERMS_VERSION})
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLegalDoc('privacy')}
                  className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-blue-400 inline-flex items-center gap-1.5 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Lire la Politique de Confidentialité (v{CLIENT_PRIVACY_VERSION})
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Granular Consent Controls (Contractual/Mandatory vs Optional per RGPD) */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Accord contractuel requis
                </div>
                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-blue-500/60 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={acceptedRequired}
                    onChange={(e) => {
                      setAcceptedRequired(e.target.checked);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={submittingAccept || submittingRefuse}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="text-xs sm:text-sm text-white leading-relaxed">
                    <strong>Obligatoire :</strong> J’ai lu et j’accepte les{' '}
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        setLegalDoc('terms');
                      }}
                      className="text-blue-400 underline hover:text-blue-300"
                    >
                      Conditions Générales d’Utilisation
                    </button>{' '}
                    (v{CLIENT_TERMS_VERSION}) et j’ai pris connaissance de la{' '}
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        setLegalDoc('privacy');
                      }}
                      className="text-blue-400 underline hover:text-blue-300"
                    >
                      Politique de Confidentialité
                    </button>{' '}
                    (v{CLIENT_PRIVACY_VERSION}) pour accéder à mon compte VRU Guard Sentinel.
                  </span>
                </label>

                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 pt-1">
                  Préférences facultatives (RGPD — modifiables à tout moment)
                </div>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={optNotifications}
                    onChange={(e) => setOptNotifications(e.target.checked)}
                    disabled={submittingAccept || submittingRefuse}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-slate-100">Notifications préventives :</strong> J’accepte de recevoir les notifications d’information produit et alertes préventives non urgentes (les alertes de sécurité critiques restent actives si autorisées).
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={optLocationEnhancements}
                    onChange={(e) => setOptLocationEnhancements(e.target.checked)}
                    disabled={submittingAccept || submittingRefuse}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-slate-100">Amélioration cartographique :</strong> J’accepte le traitement de statistiques techniques de précision lors de mes déplacements pour affiner les zones de vigilance VRU (indépendant de la permission GPS de votre appareil).
                  </span>
                </label>
              </div>

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Pinned Responsive Action Bar */}
            <footer className="px-5 sm:px-7 py-4 border-t border-slate-800 bg-slate-950/85 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={handleRefuse}
                disabled={submittingAccept || submittingRefuse}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingRefuse && <Loader2 className="w-4 h-4 animate-spin" />}
                Refuser
              </button>

              <button
                type="submit"
                disabled={!acceptedRequired || submittingAccept || submittingRefuse}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs sm:text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed shadow-lg shadow-blue-950/40"
              >
                {submittingAccept ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {submittingAccept ? 'Validation sécurisée...' : "J'accepte et je continue"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
};
