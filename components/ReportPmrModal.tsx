import React, { useState } from 'react';
import { X, MapPin, Accessibility } from 'lucide-react';
import { pmrService } from '../services/PmrService';
import { Coordinates } from '../types';
import { toast } from 'sonner';

interface Props {
  location: Coordinates;
  onClose: () => void;
  onReported: () => void;
}

export const ReportPmrModal: React.FC<Props> = ({ location, onClose, onReported }) => {
  const [isAccessible, setIsAccessible] = useState<boolean>(false);
  const [type, setType] = useState<string>('steps');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await pmrService.submitFeedback(
        location,
        isAccessible,
        isAccessible ? [] : [type],
        description
      );
      toast.success('Signalement PMR envoyé !');
      onReported();
      onClose();
    } catch (error) {
      console.error("Failed to report PMR:", error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Accessibility size={20} className="text-blue-400" />
            Signalement Accessibilité
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
            <MapPin size={16} className="text-blue-400" />
            <span>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Lieu adapté en fauteuil / poussette ?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAccessible(true)}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  isAccessible 
                    ? 'bg-green-500/20 border-green-500 text-green-400' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Oui, adapté
              </button>
              <button
                type="button"
                onClick={() => setIsAccessible(false)}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  !isAccessible 
                    ? 'bg-red-500/20 border-red-500 text-red-400' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Non / Obstacle
              </button>
            </div>
          </div>

          {!isAccessible && (
             <div>
               <label className="block text-sm font-medium text-slate-300 mb-1">Type d'obstacle</label>
               <select 
                 value={type} 
                 onChange={(e) => setType(e.target.value)}
                 className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
               >
                 <option value="steps">Escaliers / Marches</option>
                 <option value="kerb">Bordure non abaissée</option>
                 <option value="slope">Pente trop forte (&gt;5%)</option>
                 <option value="surface">Revêtement dégradé / Pavés</option>
                 <option value="works">Travaux temporaires</option>
                 <option value="other">Autre</option>
               </select>
             </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Commentaire (optionnel)</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Précisions..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none h-20"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 mt-2"
          >
            {isSubmitting ? 'Envoi...' : 'Envoyer le signalement'}
          </button>
        </form>
      </div>
    </div>
  );
};
