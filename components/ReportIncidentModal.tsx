import React, { useState } from 'react';
import { X, MapPin, AlertTriangle, Clock, Info } from 'lucide-react';
import { IncidentType, IncidentSeverity, Coordinates } from '../types';
import { incidentService } from '../services/IncidentService';
import { toast } from 'sonner';

interface Props {
  location: Coordinates;
  onClose: () => void;
  onReported: () => void;
}

export const ReportIncidentModal: React.FC<Props> = ({ location, onClose, onReported }) => {
  const [type, setType] = useState<IncidentType>(IncidentType.ROADWORKS);
  const [severity, setSeverity] = useState<IncidentSeverity>(IncidentSeverity.MEDIUM);
  const [description, setDescription] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await incidentService.reportIncident(type, severity, location, ttlHours, description);
      toast.success('Incident reported successfully');
      onReported();
      onClose();
    } catch (error) {
      console.error("Failed to report incident:", error);
      toast.error('Failed to report incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            Report an Issue
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value as IncidentType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value={IncidentType.ROADWORKS}>Roadworks</option>
              <option value={IncidentType.ROAD_CLOSED}>Road Closed</option>
              <option value={IncidentType.SIDEWALK_CLOSED}>Sidewalk Closed</option>
              <option value={IncidentType.DANGER}>Danger</option>
              <option value={IncidentType.ACCIDENT}>Accident</option>
              <option value={IncidentType.OBSTACLE}>Obstacle</option>
              <option value={IncidentType.OTHER}>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Severity</label>
            <div className="flex gap-2">
              {(['LOW', 'MEDIUM', 'HIGH'] as IncidentSeverity[]).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    severity === sev 
                      ? sev === 'LOW' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : sev === 'MEDIUM' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-red-500/20 border-red-500/50 text-red-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Duration (Expires in)</label>
            <div className="flex gap-2">
              {[2, 24, 168].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setTtlHours(hours)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1 ${
                    ttlHours === hours 
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Clock size={14} />
                  {hours === 168 ? '7 Days' : `${hours} Hours`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Provide more details..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};