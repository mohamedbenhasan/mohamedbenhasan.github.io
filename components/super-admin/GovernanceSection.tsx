import React, { useCallback, useEffect, useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Globe,
  History,
} from 'lucide-react';
import {
  AuditLogEntry,
  PlanRegionalConfig,
  PlatformSettings,
  PriceChangeHistoryEntry,
  SubscriptionPlan,
} from '../../types';
import { superAdminService } from '../../services/SuperAdminService';
import { DEFAULT_REGIONAL_PLANS, formatPrice } from '../../utils/subscriptionPlans';
import { toast } from '../../services/NotificationService';
import { formatDateTimeFr } from './SuperAdminShared';

// ===============================================================
// 1. Platform Settings Section
// ===============================================================

export const SettingsSection: React.FC<{
  refreshTick: number;
  onOpenReauth: (title: string, description: string, retryFn: () => Promise<void>) => void;
  onChanged: () => void;
}> = ({ refreshTick, onOpenReauth, onChanged }) => {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceChangeHistoryEntry[]>([]);
  const [priceReason, setPriceReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const normalizeLocalSettings = (s: PlatformSettings): PlatformSettings => {
    const baseReg = s.regionalPlans || {
      FREE: { ...DEFAULT_REGIONAL_PLANS.FREE },
      PREMIUM: {
        ...DEFAULT_REGIONAL_PLANS.PREMIUM,
        monthlyPriceTnd: s.planPrices.premiumMonthlyTnd,
        annualPriceTnd: s.planPrices.premiumAnnualTnd,
        monthlyPriceEur: s.planPrices.premiumMonthlyEur ?? DEFAULT_REGIONAL_PLANS.PREMIUM.monthlyPriceEur,
        annualPriceEur: s.planPrices.premiumAnnualEur ?? DEFAULT_REGIONAL_PLANS.PREMIUM.annualPriceEur,
      },
      FAMILY: {
        ...DEFAULT_REGIONAL_PLANS.FAMILY,
        monthlyPriceTnd: s.planPrices.familyMonthlyTnd,
        annualPriceTnd: s.planPrices.familyAnnualTnd,
        monthlyPriceEur: s.planPrices.familyMonthlyEur ?? DEFAULT_REGIONAL_PLANS.FAMILY.monthlyPriceEur,
        annualPriceEur: s.planPrices.familyAnnualEur ?? DEFAULT_REGIONAL_PLANS.FAMILY.annualPriceEur,
      },
      BUSINESS: { ...DEFAULT_REGIONAL_PLANS.BUSINESS },
    };
    return {
      ...s,
      regionalPlans: baseReg,
    };
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getSettings();
      setSettings(normalizeLocalSettings(res.settings));
      setPriceHistory(res.priceHistory || []);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des paramètres.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings, refreshTick]);

  const updateRegionalPlan = (
    planId: SubscriptionPlan,
    patch: Partial<PlanRegionalConfig>
  ) => {
    if (!settings) return;
    const currentReg = settings.regionalPlans || { ...DEFAULT_REGIONAL_PLANS };
    const updatedPlan: PlanRegionalConfig = {
      ...currentReg[planId],
      ...patch,
    };
    const nextRegional = {
      ...currentReg,
      [planId]: updatedPlan,
    };
    const nextPlanPrices = { ...settings.planPrices };
    if (planId === 'PREMIUM') {
      if (patch.monthlyPriceTnd !== undefined && patch.monthlyPriceTnd !== null) {
        nextPlanPrices.premiumMonthlyTnd = patch.monthlyPriceTnd;
      }
      if (patch.annualPriceTnd !== undefined && patch.annualPriceTnd !== null) {
        nextPlanPrices.premiumAnnualTnd = patch.annualPriceTnd;
      }
      if (patch.monthlyPriceEur !== undefined && patch.monthlyPriceEur !== null) {
        nextPlanPrices.premiumMonthlyEur = patch.monthlyPriceEur;
      }
      if (patch.annualPriceEur !== undefined && patch.annualPriceEur !== null) {
        nextPlanPrices.premiumAnnualEur = patch.annualPriceEur;
      }
    }
    if (planId === 'FAMILY') {
      if (patch.monthlyPriceTnd !== undefined && patch.monthlyPriceTnd !== null) {
        nextPlanPrices.familyMonthlyTnd = patch.monthlyPriceTnd;
      }
      if (patch.annualPriceTnd !== undefined && patch.annualPriceTnd !== null) {
        nextPlanPrices.familyAnnualTnd = patch.annualPriceTnd;
      }
      if (patch.monthlyPriceEur !== undefined && patch.monthlyPriceEur !== null) {
        nextPlanPrices.familyMonthlyEur = patch.monthlyPriceEur;
      }
      if (patch.annualPriceEur !== undefined && patch.annualPriceEur !== null) {
        nextPlanPrices.familyAnnualEur = patch.annualPriceEur;
      }
    }
    setSettings({
      ...settings,
      planPrices: nextPlanPrices,
      regionalPlans: nextRegional,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);

    const runSave = async (forceRefreshToken = false) => {
      const res = await superAdminService.updateSettings(
        {
          ...settings,
          reason: priceReason.trim() || undefined,
        },
        forceRefreshToken
      );
      setSettings(normalizeLocalSettings(res.settings));
      if (res.priceHistory) {
        setPriceHistory(res.priceHistory);
      }
      setPriceReason('');
      toast.success('Paramètres plateforme et tarifs régionaux enregistrés.');
      onChanged();
    };

    try {
      await runSave(false);
    } catch (err: any) {
      if (err?.code === 'REAUTH_REQUIRED') {
        setSaving(false);
        onOpenReauth(
          'Confirmer la modification des paramètres',
          'La modification de la configuration globale de VruGuard requiert une ré-authentification récente.',
          async () => {
            await runSave(true);
          }
        );
        return;
      }
      toast.error(err?.message || 'Sauvegarde impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-xs text-slate-400">
        Chargement de la configuration...
      </div>
    );
  }

  if (!settings) return null;

  return (
    <form onSubmit={handleSave} className="space-y-6 text-xs">
      {/* General Identity */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          Identité &amp; Contacts de la plateforme
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-400 mb-1">Nom de la plateforme</label>
            <input
              type="text"
              value={settings.platformName}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-400 mb-1">URL du logo (optionnel)</label>
            <input
              type="text"
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
              placeholder="https://..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-400 mb-1">Email de contact</label>
            <input
              type="email"
              value={settings.contactEmail}
              onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-400 mb-1">Email du support</label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </section>

      {/* Regional Multi-Currency Pricing & Plan Activation */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              Tarification régionale multidevise (TND / EUR) &amp; Activation des plans
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Définissez indépendamment les tarifs en Dinar Tunisien (Tunisie) et en Euro (International), et activez ou désactivez chaque formule.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Plan</th>
                <th className="py-3 px-4 font-semibold">Statut</th>
                <th className="py-3 px-4 font-semibold">Tunisie · Mensuel (TND)</th>
                <th className="py-3 px-4 font-semibold">Tunisie · Annuel (TND)</th>
                <th className="py-3 px-4 font-semibold">International · Mensuel (EUR €)</th>
                <th className="py-3 px-4 font-semibold">International · Annuel (EUR €)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 tabular-nums">
              {(['FREE', 'PREMIUM', 'FAMILY', 'BUSINESS'] as SubscriptionPlan[]).map((planId) => {
                const reg = settings.regionalPlans?.[planId] || DEFAULT_REGIONAL_PLANS[planId];
                const isFixedFree = planId === 'FREE';
                const isCustom = planId === 'BUSINESS';
                return (
                  <tr key={planId} className="hover:bg-slate-800/20">
                    <td className="py-3 px-4 font-display font-bold text-white">{planId}</td>
                    <td className="py-3 px-4">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reg.enabled !== false}
                          onChange={(e) =>
                            updateRegionalPlan(planId, { enabled: e.target.checked })
                          }
                          className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                        />
                        <span
                          className={`font-semibold ${
                            reg.enabled !== false ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {reg.enabled !== false ? 'Actif' : 'Désactivé'}
                        </span>
                      </label>
                    </td>
                    <td className="py-3 px-4">
                      {isCustom ? (
                        <span className="text-slate-500 font-mono">Sur devis</span>
                      ) : isFixedFree ? (
                        <span className="text-slate-400 font-mono">0 TND</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={reg.monthlyPriceTnd ?? 0}
                          onChange={(e) =>
                            updateRegionalPlan(planId, {
                              monthlyPriceTnd: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono outline-none focus:border-blue-500"
                        />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isCustom ? (
                        <span className="text-slate-500 font-mono">Sur devis</span>
                      ) : isFixedFree ? (
                        <span className="text-slate-400 font-mono">0 TND</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={reg.annualPriceTnd ?? 0}
                          onChange={(e) =>
                            updateRegionalPlan(planId, {
                              annualPriceTnd: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono outline-none focus:border-blue-500"
                        />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isCustom ? (
                        <span className="text-slate-500 font-mono">Sur devis</span>
                      ) : isFixedFree ? (
                        <span className="text-slate-400 font-mono">0 €</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={reg.monthlyPriceEur ?? 0}
                          onChange={(e) =>
                            updateRegionalPlan(planId, {
                              monthlyPriceEur: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono outline-none focus:border-blue-500"
                        />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isCustom ? (
                        <span className="text-slate-500 font-mono">Sur devis</span>
                      ) : isFixedFree ? (
                        <span className="text-slate-400 font-mono">0 €</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={reg.annualPriceEur ?? 0}
                          onChange={(e) =>
                            updateRegionalPlan(planId, {
                              annualPriceEur: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono outline-none focus:border-blue-500"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <label className="block font-semibold text-slate-400 mb-1">
            Motif de la modification tarifaire / statut (enregistré dans l’historique)
          </label>
          <input
            type="text"
            value={priceReason}
            onChange={(e) => setPriceReason(e.target.value)}
            placeholder="Ex. Ajustement tarifaire zone Europe / Promotion lancement..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.pioneerProgramEnabled}
              onChange={(e) => setSettings({ ...settings, pioneerProgramEnabled: e.target.checked })}
              className="rounded border-slate-700 bg-slate-900 text-blue-600"
            />
            <span className="text-slate-200 font-medium">Programme Pioneer actif</span>
          </label>
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.accessibilityProgramEnabled}
              onChange={(e) =>
                setSettings({ ...settings, accessibilityProgramEnabled: e.target.checked })
              }
              className="rounded border-slate-700 bg-slate-900 text-blue-600"
            />
            <span className="text-slate-200 font-medium">Programme Accessibilité ouvert</span>
          </label>
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })}
              className="rounded border-slate-700 bg-slate-900 text-blue-600"
            />
            <span className="text-slate-200 font-medium">Notifications globales actives</span>
          </label>
        </div>
      </section>

      {/* Maintenance & Announcement Banner */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Mode Maintenance &amp; Bannière d’annonce
        </h2>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="rounded border-slate-700 bg-slate-900 text-amber-500"
              />
              <span className="font-semibold text-amber-300">
                Activer le Mode Maintenance (bloque les utilisateurs ordinaires, conserve l’accès Super Admin)
              </span>
            </label>
            <input
              type="text"
              value={settings.maintenanceMessage}
              onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
              placeholder="Message affiché pendant la maintenance..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.announcementEnabled}
                  onChange={(e) =>
                    setSettings({ ...settings, announcementEnabled: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-900 text-blue-500"
                />
                <span className="font-semibold text-blue-300">
                  Afficher une bannière d’annonce globale
                </span>
              </label>
              <select
                value={settings.announcementType}
                onChange={(e) => setSettings({ ...settings, announcementType: e.target.value as any })}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white outline-none"
              >
                <option value="info">Info</option>
                <option value="warning">Avertissement</option>
                <option value="success">Succès</option>
              </select>
            </div>
            <input
              type="text"
              value={settings.announcementText}
              onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
              placeholder="Texte de la bannière visible sur l’application..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer la configuration
        </button>
      </div>

      {/* Price Modification History */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            Historique des modifications tarifaires ({priceHistory.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Champ</th>
                <th className="py-3 px-4">Ancien → Nouveau</th>
                <th className="py-3 px-4">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 tabular-nums">
              {priceHistory.map((entry) => {
                const formatVal = (v: number | boolean | null) => {
                  if (typeof v === 'boolean') return v ? 'Actif' : 'Désactivé';
                  if (v === null || v === undefined) return '—';
                  return entry.currency ? formatPrice(v, entry.currency) : String(v);
                };
                const fieldLabels: Record<string, string> = {
                  enabled: 'Statut du plan',
                  monthlyPriceTnd: 'Mensuel (TND)',
                  annualPriceTnd: 'Annuel (TND)',
                  monthlyPriceEur: 'Mensuel (EUR)',
                  annualPriceEur: 'Annuel (EUR)',
                };
                return (
                  <tr key={entry.id} className="hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {formatDateTimeFr(entry.timestamp)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{entry.adminEmail}</td>
                    <td className="py-3 px-4 font-bold text-white">{entry.plan}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {fieldLabels[entry.field] || entry.field}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-slate-400">{formatVal(entry.oldValue)}</span>
                      <span className="mx-1.5 text-slate-600">→</span>
                      <span className="text-emerald-400 font-semibold">
                        {formatVal(entry.newValue)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{entry.reason || '—'}</td>
                  </tr>
                );
              })}
              {priceHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-center text-slate-500">
                    Aucune modification tarifaire enregistrée pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  );
};

// ===============================================================
// 2. Security & RBAC Section
// ===============================================================

export const SecuritySection: React.FC<{
  refreshTick: number;
  onOpenReauth: (title: string, description: string, retryFn: () => Promise<void>) => void;
  onChanged: () => void;
}> = ({ refreshTick, onOpenReauth, onChanged }) => {
  const [data, setData] = useState<{
    securitySettings: PlatformSettings['securitySettings'];
    recentSecurityEvents: AuditLogEntry[];
    hasAdminIam: boolean;
    currentAdmin: { uid: string; email: string | null; role: string; authTimeMs: number };
  } | null>(null);
  const [delegatedText, setDelegatedText] = useState('');
  const [rateLimit, setRateLimit] = useState(120);
  const [requireReauth, setRequireReauth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSecurity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminService.getSecurityOverview();
      setData(res);
      setDelegatedText(res.securitySettings.delegatedAdminEmails.join(', '));
      setRateLimit(res.securitySettings.adminRateLimitPerMin);
      setRequireReauth(res.securitySettings.requireReauthForCriticalActions);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement de la sécurité.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSecurity();
  }, [loadSecurity, refreshTick]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    const emails = delegatedText
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const runSave = async (forceRefreshToken = false) => {
      await superAdminService.updateSettings(
        {
          securitySettings: {
            ...data.securitySettings,
            requireReauthForCriticalActions: requireReauth,
            adminRateLimitPerMin: Number(rateLimit),
            delegatedAdminEmails: emails,
          },
        },
        forceRefreshToken
      );
      toast.success('Politique de sécurité mise à jour.');
      await loadSecurity();
      onChanged();
    };

    try {
      await runSave(false);
    } catch (err: any) {
      if (err?.code === 'REAUTH_REQUIRED') {
        setSaving(false);
        onOpenReauth(
          'Validation sécurité Super Admin',
          'La modification des administrateurs délégués ou de la politique RBAC exige une ré-authentification.',
          async () => {
            await runSave(true);
          }
        );
        return;
      }
      toast.error(err?.message || 'Mise à jour impossible.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-xs text-slate-400">
        Chargement des contrôles de sécurité...
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6 text-xs">
      {/* Admin Session & Server Integrity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-slate-400">Session Super Admin active</div>
          <div className="font-mono text-white font-semibold">{data.currentAdmin.email}</div>
          <div className="text-[11px] text-emerald-400">Rôle serveur : {data.currentAdmin.role}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-slate-400">Fraîcheur du jeton (auth_time)</div>
          <div className="font-mono text-white font-semibold tabular-nums">
            {formatDateTimeFr(data.currentAdmin.authTimeMs)}
          </div>
          <div className="text-[11px] text-slate-500">Seuil critique : 30 min</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="text-slate-400">Mode d’accès Firebase</div>
          <div className="font-semibold text-white flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {data.hasAdminIam ? 'Admin SDK complet' : 'Starter Tier (ID Token + REST vérifié)'}
          </div>
          <div className="text-[11px] text-slate-500">
            Vérification signature JWT active sur toutes les routes
          </div>
        </div>
      </div>

      {/* RBAC Matrix */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Matrice des rôles &amp; permissions RBAC
          </h2>
          <button
            onClick={loadSecurity}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.entries(data.securitySettings.permissionMatrix) as Array<[string, string[]]>).map(
            ([roleName, perms]) => (
              <div key={roleName} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-mono font-bold text-amber-400">{roleName}</div>
                <div className="flex flex-wrap gap-1.5">
                  {perms.map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300"
                  >
                    {p}
                  </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        <form onSubmit={handleSavePolicy} className="pt-3 border-t border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">
                Administrateurs délégués (rôle ADMIN limité, séparés par virgule)
              </label>
              <input
                type="text"
                value={delegatedText}
                onChange={(e) => setDelegatedText(e.target.value)}
                placeholder="ex. support@vruguard.me"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">
                Rate-limit Admin (requêtes / min / IP)
              </label>
              <input
                type="number"
                min={20}
                max={1000}
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={requireReauth}
              onChange={(e) => setRequireReauth(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-amber-500"
            />
            <span className="text-slate-200 font-medium">
              Exiger une ré-authentification récente (&lt; 30 min) pour bannissement, suppression définitive et modification des paramètres critiques
            </span>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-[#ffffff] font-semibold inline-flex items-center gap-2 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Appliquer la politique sécurité
            </button>
          </div>
        </form>
      </section>

      {/* Recent Security Events */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="font-display text-sm font-bold text-white">
            Événements de sécurité &amp; tentatives refusées ({data.recentSecurityEvents.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-800/70">
          {data.recentSecurityEvents.map((ev) => (
            <div key={ev.id} className="px-5 py-3 flex justify-between gap-3">
              <div>
                <span
                  className={`font-mono font-semibold ${
                    ev.outcome === 'denied' ? 'text-red-400' : 'text-blue-300'
                  }`}
                >
                  {ev.action}
                </span>{' '}
                · <span className="font-mono text-slate-400">{ev.adminEmail}</span>
                <p className="text-slate-300 mt-0.5">{ev.detail}</p>
              </div>
              <span className="text-slate-500 tabular-nums whitespace-nowrap">
                {formatDateTimeFr(ev.timestamp)}
              </span>
            </div>
          ))}
          {data.recentSecurityEvents.length === 0 && (
            <div className="p-6 text-center text-slate-500">Aucun événement critique récent.</div>
          )}
        </div>
      </section>
    </div>
  );
};
