import React from 'react';
import { Globe, RotateCcw } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { SupportedCurrency } from '../types';

interface CurrencySelectorProps {
  compact?: boolean;
  showOriginHint?: boolean;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  compact = false,
  showOriginHint = true,
}) => {
  const {
    currency,
    currencySource,
    detectedCountry,
    detectedCurrency,
    setCurrency,
    resetCurrencyToAuto,
  } = useAuth();

  const handleSelect = (next: SupportedCurrency) => {
    if (next !== currency) {
      setCurrency(next);
    }
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-2.5">
      <div
        className="inline-flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl"
        role="group"
        aria-label="Sélecteur de devise"
      >
        <span className="inline-flex items-center gap-1.5 pl-2.5 pr-2 text-[11px] font-medium text-slate-400">
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          {!compact && <span>Devise</span>}
        </span>

        <button
          type="button"
          onClick={() => handleSelect('TND')}
          aria-pressed={currency === 'TND'}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors tabular-nums ${
            currency === 'TND'
              ? 'bg-blue-600 text-[#ffffff]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          TND
        </button>

        <button
          type="button"
          onClick={() => handleSelect('EUR')}
          aria-pressed={currency === 'EUR'}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors tabular-nums ${
            currency === 'EUR'
              ? 'bg-blue-600 text-[#ffffff]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          EUR €
        </button>
      </div>

      {showOriginHint && (
        <div className="inline-flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span>
            {currencySource === 'manual'
              ? `Choix manuel (${currency})`
              : detectedCountry
              ? `Auto · ${detectedCountry} (${currency})`
              : `Auto · Défaut (${currency})`}
          </span>
          {currencySource === 'manual' && detectedCurrency !== currency && (
            <button
              type="button"
              onClick={resetCurrencyToAuto}
              title={`Revenir à la devise détectée (${detectedCurrency})`}
              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Auto</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
