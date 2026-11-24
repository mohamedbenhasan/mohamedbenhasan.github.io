import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  ArrowLeft,
  Loader2,
  KeyRound,
  X,
} from 'lucide-react';
import { AccountStatus, PresenceState, SubscriptionPlan } from '../../types';

export function formatDateFr(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeFr(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTimeFr(ms?: number | null): string {
  if (!ms) return 'Jamais';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'À l’instant';
  if (diff < 3600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3600_000)} h`;
  return `Il y a ${Math.floor(diff / 86_400_000)} j`;
}

export const PresenceDot: React.FC<{ state: PresenceState; showLabel?: boolean }> = ({
  state,
  showLabel = true,
}) => {
  const cfg =
    state === 'online'
      ? { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'En ligne' }
      : state === 'idle'
      ? { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Inactif' }
      : { dot: 'bg-slate-500', text: 'text-slate-400', label: 'Hors ligne' };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
};

export const AccountStatusText: React.FC<{ status: AccountStatus }> = ({ status }) => {
  switch (status) {
    case 'active':
      return <span className="text-xs font-semibold text-emerald-400">Actif</span>;
    case 'suspended':
      return <span className="text-xs font-semibold text-amber-400">Suspendu</span>;
    case 'banned':
      return <span className="text-xs font-semibold text-red-400">Banni</span>;
    case 'soft_deleted':
      return <span className="text-xs font-semibold text-slate-400">Supprimé (soft)</span>;
    default:
      return <span className="text-xs text-slate-400">{status}</span>;
  }
};

export const PlanText: React.FC<{ plan: SubscriptionPlan; isLifetime?: boolean }> = ({
  plan,
  isLifetime,
}) => {
  const color =
    plan === 'BUSINESS'
      ? 'text-emerald-400'
      : plan === 'FAMILY'
      ? 'text-indigo-400'
      : plan === 'PREMIUM'
      ? 'text-blue-400'
      : 'text-slate-400';

  return (
    <span className={`text-xs font-bold ${color}`}>
      {plan}
      {isLifetime ? ' (À vie)' : ''}
    </span>
  );
};

export const AccessDenied403: React.FC<{
  onReturnHome: () => void;
  userEmail?: string | null;
}> = ({ onReturnHome, userEmail }) => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
    <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
      <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-mono uppercase tracking-widest text-red-400">
          HTTP 403 · Accès Refusé
        </p>
        <h1 className="font-display text-2xl font-bold text-white">
          Zone strictement réservée
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Vous ne disposez pas des privilèges Super Administrateur requis pour accéder à cette console de contrôle. Cette tentative a été journalisée.
        </p>
        {userEmail && (
          <p className="text-xs font-mono text-slate-500 pt-1">
            Compte connecté : {userEmail}
          </p>
        )}
      </div>
      <button
        onClick={onReturnHome}
        className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retourner à VruGuard
      </button>
    </div>
  </div>
);

interface ReauthModalProps {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirmReauth: (password?: string) => Promise<void>;
  hasPasswordProvider: boolean;
}

export const ReauthConfirmModal: React.FC<ReauthModalProps> = ({
  open,
  title,
  description,
  onClose,
  onConfirmReauth,
  hasPasswordProvider,
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onConfirmReauth(hasPasswordProvider ? password : undefined);
      setPassword('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ré-authentification refusée.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130000] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="font-display text-base font-bold text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">{description}</p>
          {hasPasswordProvider ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Confirmez votre mot de passe Super Admin
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-500"
              />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Une fenêtre Google s’ouvrira pour valider votre identité récente.</span>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-300">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-[#ffffff] text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirmer l’identité
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
