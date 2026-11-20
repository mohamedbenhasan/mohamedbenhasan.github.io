import React, { useState, useEffect } from 'react';
import { advancedGeolocationService, IndoorAnchor } from '../services/AdvancedGeolocationService';
import { Coordinates } from '../types';

interface InternalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGps: Coordinates | null;
}

export const IndoorCalibrationModal: React.FC<InternalProps> = ({ isOpen, onClose, currentGps }) => {
  const [anchors, setAnchors] = useState<IndoorAnchor[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newAnchor, setNewAnchor] = useState<Partial<IndoorAnchor>>({});

  useEffect(() => {
    if (isOpen) {
      setAnchors([...advancedGeolocationService.indoorAnchors]);
    }
  }, [isOpen]);

  const handleSave = async () => {
    await advancedGeolocationService.saveAnchors(anchors);
    onClose();
  };

  const addCurrentLocation = () => {
    if (!currentGps) {
      alert("No GPS signal available to calibrate from.");
      return;
    }
    setNewAnchor({
      id: "anchor_" + Date.now(),
      coords: currentGps,
      radiusMeters: 50,
      floor: 0,
      name: "My Home",
      apartment: "A1"
    });
    setIsAdding(true);
  };

  const confirmAdd = () => {
    if (newAnchor.name && newAnchor.coords && newAnchor.floor !== undefined) {
      setAnchors([...anchors, newAnchor as IndoorAnchor]);
      setIsAdding(false);
      setNewAnchor({});
    }
  };

  const removeAnchor = (id: string) => {
    setAnchors(anchors.filter(a => a.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
        <h2 className="text-xl font-bold text-slate-100 mb-2">High Precision Indoor Calibration</h2>
        <p className="text-sm text-slate-400 mb-6">
          To achieve &lt; 0.5m indoor precision where GPS fails, map your Wi-Fi BSSID or current location as an anchor. 
          When your device recognizes it's within the radius, it will snap to the exact floor and apartment.
        </p>

        {isAdding ? (
          <div className="bg-slate-800 p-4 rounded-lg mb-6 border border-slate-700 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-slate-200">New Anchor Definition</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Name / Label</label>
                <input 
                  type="text" 
                  value={newAnchor.name || ''} 
                  onChange={e => setNewAnchor({...newAnchor, name: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  placeholder="e.g. Village 1 - Apt G"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Floor Level</label>
                <input 
                  type="number" 
                  value={newAnchor.floor === undefined ? '' : newAnchor.floor} 
                  onChange={e => setNewAnchor({...newAnchor, floor: parseInt(e.target.value)})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Room / Apartment ID</label>
                <input 
                  type="text" 
                  value={newAnchor.apartment || ''} 
                  onChange={e => setNewAnchor({...newAnchor, apartment: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  placeholder="e.g. Apt G"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Activation Radius (m)</label>
                <input 
                  type="number" 
                  value={newAnchor.radiusMeters || 50} 
                  onChange={e => setNewAnchor({...newAnchor, radiusMeters: parseInt(e.target.value)})}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                  title="If GPS gets within this radius, High Precision locks on"
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end mt-2">
              <button onClick={() => setIsAdding(false)} className="px-3 py-1 text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmAdd} className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors">Confirm Anchor</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
            {anchors.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm italic">
                No indoor anchors defined.
              </div>
            ) : anchors.map(a => (
              <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex justify-between items-center group">
                <div>
                  <div className="font-medium text-slate-200">{a.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Floor: {a.floor} | Apt: {a.apartment}</div>
                </div>
                <button 
                  onClick={() => removeAnchor(a.id)}
                  className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-400/20 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
            
            <button 
              onClick={addCurrentLocation}
              className="w-full py-3 border border-dashed border-slate-600 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Use Current Location as Anchor
            </button>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
           <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             UWB & MLS Mock Enabled
           </div>
           <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition-colors border border-blue-500"
              >
                Save Configuration
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
