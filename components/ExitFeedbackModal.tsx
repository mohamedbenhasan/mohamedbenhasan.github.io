import React, { useState } from 'react';
import { X, Star, Send } from 'lucide-react';
import { ExitFeedback, appFeedbackService } from '../services/AppFeedbackService';

interface Props {
  userId: string;
  vruType?: string;
  onProceedToLogout: () => void;
}

const FEEDBACK_TAGS = [
  'ETA',
  'Routes/Itinéraires',
  'Zones/Sécurité',
  'PMR',
  'Bugs',
  'Performance',
  'Autre'
];

export const ExitFeedbackModal: React.FC<Props> = ({ userId, vruType, onProceedToLogout }) => {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSkip = () => {
    appFeedbackService.markFeedbackSkippedOrSubmitted();
    onProceedToLogout();
  };

  const handleSubmit = async () => {
    if (rating === 0) {
       handleSkip();
       return;
    }
    
    setIsSubmitting(true);
    const feedback: ExitFeedback = {
      userId,
      rating,
      comment,
      categoryTags: selectedTags,
      metadata: {
        appVersion: '1.0.0', // Standard
        vruType,
        userAgent: navigator.userAgent
      }
    };

    try {
      await appFeedbackService.submitExitFeedback(feedback);
    } catch(e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
      onProceedToLogout();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9000] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            🤝 Évaluation de l'expérience
          </h2>
          <button 
            onClick={handleSkip}
            className="text-slate-400 hover:text-white p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Rating */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-medium text-slate-300">
              Comment évaluez-vous votre trajet ?
            </span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 p-1"
                >
                  <Star 
                    size={32} 
                    className={`${(hoverRating || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'} transition-colors`} 
                  />
                </button>
              ))}
            </div>
          </div>

          {rating > 0 && rating <= 2 && (
            <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 px-3 py-2 rounded text-xs">
              Désolé pour cette mauvaise expérience. Pouvez-vous nous donner plus de détails ?
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
             <span className="text-xs font-medium text-slate-400">Ce qui a retenu votre attention (Optionnel) :</span>
             <div className="flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map(tag => (
                   <button
                     key={tag}
                     onClick={() => handleTagToggle(tag)}
                     className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${selectedTags.includes(tag) ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                   >
                     {tag}
                   </button>
                ))}
             </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
             <span className="text-xs font-medium text-slate-400">
               Votre avis (Optionnel) :
             </span>
             <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Racontez-nous tout..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white placeholder-slate-600 min-h-[80px] focus:outline-none focus:border-blue-500 transition-colors resize-none"
             />
          </div>
        </div>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3">
           <button 
             onClick={handleSkip}
             className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
           >
             Ignorer (Déconnexion)
           </button>
           <button 
             onClick={handleSubmit}
             disabled={rating === 0 || isSubmitting}
             className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-bold rounded flex items-center gap-2 transition-colors"
           >
             {isSubmitting ? (
               <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
             ) : (
               <Send size={16} />
             )}
             Envoyer & {rating > 0 ? 'Quitter' : 'Se déconnecter'}
           </button>
        </div>
      </div>
    </div>
  );
};
