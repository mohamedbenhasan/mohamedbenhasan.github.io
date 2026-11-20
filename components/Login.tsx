import React, { useState } from 'react';
import { ArrowLeft, Loader2, CreditCard } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { VruLogo } from './VruLogo';

interface LoginProps {
  onBackToHome?: () => void;
  onOpenPricing?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBackToHome, onOpenPricing }) => {
  const { loginWithGoogle, loginWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google login error:', err);
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/popup-blocked' ||
        err.code === 'auth/unauthorized-domain'
      ) {
        setError(
          'La fenêtre Google a été bloquée par votre navigateur. Veuillez autoriser les popups et réessayer.'
        );
      } else {
        setError(err.message || 'Une erreur est survenue lors de la connexion Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          throw new Error('Le nom complet est requis.');
        }
        await signUpWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de l'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Compact Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {onBackToHome ? (
            <button
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Accueil
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <VruLogo className="w-7 h-7 rounded-lg" />
            <span className="font-display font-bold text-base text-white">VruGuard</span>
          </div>

          <div className="flex items-center gap-3">
            {onOpenPricing && (
              <button
                onClick={onOpenPricing}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                Tarifs
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Centered Form */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-up">
          <div className="text-center space-y-2">
            <VruLogo className="w-14 h-14 rounded-2xl mx-auto shadow-lg shadow-blue-600/15" />
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {isSignUp ? 'Créer votre compte VruGuard' : 'Connexion à votre espace'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {isSignUp
                ? 'Démarrez gratuitement avec la carte interactive et la navigation de base.'
                : 'Retrouvez votre tableau de bord, vos trajets et votre abonnement.'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-xs sm:text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  placeholder="Youssef Ben Ali"
                  required={isSignUp}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Adresse e-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="vous@exemple.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="6 caractères minimum"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold text-sm py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading
                ? 'Traitement en cours...'
                : isSignUp
                ? 'Créer mon compte gratuit'
                : 'Se connecter'}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-800 flex-1" />
            <span className="text-xs text-slate-500 font-medium">OU</span>
            <div className="h-px bg-slate-800 flex-1" />
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            disabled={loading}
            className="w-full bg-slate-950 hover:bg-slate-800 text-slate-100 border border-slate-700 font-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuer avec Google
          </button>

          <div className="text-center text-xs sm:text-sm text-slate-400 pt-1">
            {isSignUp ? (
              <p>
                Déjà inscrit ?{' '}
                <button
                  onClick={() => {
                    setIsSignUp(false);
                    setError('');
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Se connecter
                </button>
              </p>
            ) : (
              <p>
                Pas encore de compte ?{' '}
                <button
                  onClick={() => {
                    setIsSignUp(true);
                    setError('');
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold"
                >
                  Créer un compte gratuit
                </button>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
