import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import { sosService } from '../services/SosService';
import { SosSettings, SosCategoryConfig } from '../types';
import { toast } from 'sonner';

interface Props {
  lat?: number;
  lng?: number;
  vruType?: string;
  onClose: () => void;
}

export const QuickSosModal: React.FC<Props> = ({ lat, lng, vruType, onClose }) => {
  const [settings, setSettings] = useState<SosSettings | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SosCategoryConfig | null>(null);
  const [step, setStep] = useState<'SELECT' | 'CONFIRM' | 'TRIGGERING' | 'SUCCESS'>('SELECT');
  const [countdown, setCountdown] = useState(5);
  const [holdProgress, setHoldProgress] = useState(0); // for long press

  useEffect(() => {
    const unsub = sosService.subscribeToSosSettings(setSettings);
    return () => unsub();
  }, []);

  useEffect(() => {
    let timer: any;
    if (step === 'CONFIRM' && selectedCategory && settings?.antiFalseClick) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      } else if (countdown === 0 && holdProgress === 0) {
        // Automatically trigger if slider/long press is NOT required or we just use countdown.
        // Wait, if it requires action, we shouldn't auto trigger on countdown. 
        // Let's use countdown as "cancel before...", if 0, we allow trigger.
      }
    }
    return () => clearTimeout(timer);
  }, [step, countdown, selectedCategory, settings, holdProgress]);

  const handleHoldStart = () => {
    if (countdown > 0) return;
    setHoldProgress(10);
    // basic simulated hold
    const interval = setInterval(() => {
      setHoldProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          executeSos();
          return 100;
        }
        return p + 10;
      });
    }, 100);
    (window as any).__sosHoldInterval = interval;
  };

  const handleHoldEnd = () => {
    if ((window as any).__sosHoldInterval) {
      clearInterval((window as any).__sosHoldInterval);
      if (holdProgress < 100) setHoldProgress(0);
    }
  };

  const executeSos = async () => {
    if (!selectedCategory) return;
    setStep('TRIGGERING');
    try {
      const { urls } = await sosService.triggerCategorizedSos(selectedCategory.id, lat, lng, { vruType });
      setStep('SUCCESS');
      
      // Auto-open urls if possible (browser might block multiple, so we open first or rely on user click)
      urls.forEach(url => {
        window.open(url, '_blank');
      });
      
    } catch(e) {
      toast.error("Échec du SOS");
      setStep('SELECT');
    }
  };

  const activeCategories = settings?.categories.filter(c => c.enabled) || [];

  return (
    <div className="fixed inset-0 z-[100000] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 flex justify-between items-center border-b border-slate-800 bg-red-950/20">
          <div className="flex items-center gap-2 text-red-500 font-bold">
            <AlertTriangle size={20} />
            SOS URGENCE
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 rounded-full p-1.5"><X size={18} /></button>
        </div>

        {step === 'SELECT' && (
          <div className="p-6 space-y-4">
            <p className="text-slate-300 text-sm text-center mb-6">De quelle assistance avez-vous besoin ?</p>
            <div className="grid grid-cols-2 gap-3">
              {activeCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setStep('CONFIRM');
                    setCountdown(settings?.antiFalseClick ? 5 : 0);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors touch-manipulation"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-white">
                    <Phone size={24} />
                  </div>
                  <span className="font-semibold text-white">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'CONFIRM' && selectedCategory && (
          <div className="p-8 flex flex-col items-center space-y-8">
            <div className="text-center space-y-2 text-white">
              <h3 className="text-2xl font-bold">{selectedCategory.name}</h3>
              <p className="text-sm text-slate-400">Préparez-vous à alerter vos contacts</p>
            </div>

            {settings?.antiFalseClick ? (
              <div className="w-full flex justify-center">
                 {countdown > 0 ? (
                   <div className="text-5xl font-mono text-red-500 font-bold animate-pulse">
                     {countdown}
                   </div>
                 ) : (
                   <button 
                     onPointerDown={handleHoldStart}
                     onPointerUp={handleHoldEnd}
                     onPointerLeave={handleHoldEnd}
                     className="relative w-40 h-40 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border-4 border-slate-700 select-none shadow-xl shadow-red-900/20"
                   >
                      <div className="absolute bottom-0 left-0 w-full bg-red-600 transition-all duration-100 ease-linear" style={{ height: `${holdProgress}%` }}></div>
                      <span className="relative z-10 text-white font-bold text-center">
                        {holdProgress > 0 ? "MAINTENEZ..." : "APPUI LONG\nPOUR SOS"}
                      </span>
                   </button>
                 )}
              </div>
            ) : (
              <button 
                onClick={executeSos}
                className="w-40 h-40 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all transform hover:scale-105 active:scale-95"
              >
                LANCER SOS
              </button>
            )}

            <button onClick={() => setStep('SELECT')} className="text-slate-400 hover:text-white underline text-sm">
              Annuler
            </button>
          </div>
        )}

        {step === 'TRIGGERING' && (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
            <p className="text-white font-medium">Envoi de l'alerte en cours...</p>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="p-10 flex flex-col items-center justify-center space-y-6 text-center">
            <CheckCircle2 className="w-20 h-20 text-green-500" />
            <div>
              <h3 className="text-xl font-bold text-white mb-2">SOS Envoyé</h3>
              <p className="text-sm text-slate-400">Vos contacts ont été alertés. Les e-mails ont été envoyés automatiquement et des applications ont pu s'ouvrir pour les appels/messages.</p>
            </div>
            <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-2 rounded-full w-full">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
