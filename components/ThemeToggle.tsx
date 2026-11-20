import React from 'react';
import { useTheme } from './ThemeProvider';
import { Moon, Sun, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showLabel = false,
  compact = false,
  className = '',
}) => {
  const { theme, setTheme } = useTheme();

  if (compact) {
    const nextTheme =
      theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
    const labelMap = {
      light: 'Clair',
      dark: 'Sombre',
      system: 'Système',
    } as const;

    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme)}
        className={`w-10 h-10 mx-auto rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all duration-150 flex items-center justify-center shrink-0 ${className}`}
        title={`Thème : ${labelMap[theme]} (cliquer pour changer)`}
        aria-label={`Changer le thème (actuel : ${labelMap[theme]})`}
      >
        {theme === 'light' ? (
          <Sun className="w-[18px] h-[18px] shrink-0" />
        ) : theme === 'dark' ? (
          <Moon className="w-[18px] h-[18px] shrink-0" />
        ) : (
          <Monitor className="w-[18px] h-[18px] shrink-0" />
        )}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 ${className}`}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center justify-center h-8 px-2.5 rounded-lg transition-colors ${
          theme === 'light'
            ? 'bg-blue-600 text-[#ffffff] shadow-sm'
            : 'text-slate-400 hover:text-white'
        } ${showLabel ? 'flex-1' : ''}`}
        title="Mode Clair"
      >
        <Sun className="w-3.5 h-3.5 shrink-0" />
        {showLabel && <span className="ml-1.5 text-xs font-medium">Clair</span>}
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center justify-center h-8 px-2.5 rounded-lg transition-colors ${
          theme === 'dark'
            ? 'bg-blue-600 text-[#ffffff] shadow-sm'
            : 'text-slate-400 hover:text-white'
        } ${showLabel ? 'flex-1' : ''}`}
        title="Mode Sombre"
      >
        <Moon className="w-3.5 h-3.5 shrink-0" />
        {showLabel && <span className="ml-1.5 text-xs font-medium">Sombre</span>}
      </button>

      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`flex items-center justify-center h-8 px-2.5 rounded-lg transition-colors ${
          theme === 'system'
            ? 'bg-slate-700 text-[#ffffff] shadow-sm'
            : 'text-slate-400 hover:text-white'
        } ${showLabel ? 'flex-1' : ''}`}
        title="Mode Système"
      >
        <Monitor className="w-3.5 h-3.5 shrink-0" />
        {showLabel && <span className="ml-1.5 text-xs font-medium">Auto</span>}
      </button>
    </div>
  );
};
