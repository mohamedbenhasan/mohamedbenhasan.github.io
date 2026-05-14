import React, { useState, useEffect } from 'react';
import { User, Shield, Phone, Bell, Settings, ArrowLeft, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { sosService } from '../services/SosService';
import { trustService } from '../services/TrustService';
import { SosSettings, TrustedContact } from '../types';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

export const SosSettingsPage: React.FC<Props> = ({ onClose }) => {
  const [settings, setSettings] = useState<SosSettings | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub1 = sosService.subscribeToSosSettings(setSettings);
    const unsub2 = trustService.subscribeToPersonalContacts((data) => {
      setContacts(data);
      setLoading(false);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleSave = async (updatedSettings: SosSettings) => {
    try {
      await sosService.updateSosSettings(updatedSettings);
      toast.success("Paramètres SOS enregistrés.");
    } catch(e) {
      toast.error("Erreur lors de la sauvegarde.");
    }
  };

  if (!settings || loading) return <div className="p-8 text-center text-white">Chargement...</div>;

  return (
    <div className="min-h-[100vh] flex flex-col bg-slate-950 text-slate-200 overflow-y-auto overflow-x-hidden">
      <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center sticky top-0 z-10 shrink-0">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="w-6 h-6 text-indigo-400" />
            Paramètres SOS
          </h2>
          <p className="text-sm text-slate-400 mt-1">Configurez les alertes, destinataires et options anti-faux clics.</p>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-8 max-w-4xl mx-auto w-full pb-20">
        
        {/* Global Options */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
           <h3 className="font-semibold text-lg mb-4 text-white">Options Globales</h3>
           <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Anti-faux clic</div>
                  <div className="text-xs text-slate-400">Nécessite une action longue pour déclencher le SOS.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.antiFalseClick} onChange={e => {
                    const newS = {...settings, antiFalseClick: e.target.checked};
                    setSettings(newS);
                    handleSave(newS);
                  }}/>
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
             </div>
             
             <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Check-in de Sécurité</div>
                  <div className="text-xs text-slate-400">Déclenche une alerte si vous ne confirmez pas après un délai.</div>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={settings.securityCheckInMinutes} 
                    onChange={e => {
                      const newS = {...settings, securityCheckInMinutes: Number(e.target.value)};
                      setSettings(newS);
                      handleSave(newS);
                    }}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm"
                  >
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={30}>30 min</option>
                  </select>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.securityCheckInEnabled} onChange={e => {
                      const newS = {...settings, securityCheckInEnabled: e.target.checked};
                      setSettings(newS);
                      handleSave(newS);
                    }}/>
                    <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>
             </div>

             <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Partage de Position en Direct (Carte App)</div>
                  <div className="text-xs text-slate-400">Partage temporaire vers les Truested Contacts lors d'un SOS.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.liveLocationEnabled} onChange={e => {
                    const newS = {...settings, liveLocationEnabled: e.target.checked};
                    setSettings(newS);
                    handleSave(newS);
                  }}/>
                  <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
             </div>
           </div>
        </section>

        {/* Categories */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
           <h3 className="font-semibold text-lg mb-4 text-white">Catégories d'Alertes</h3>
           <div className="space-y-4">
             {settings.categories.map((cat, idx) => (
               <div key={cat.id} className="p-4 border border-slate-800 bg-slate-950 rounded-lg">
                 <div className="flex items-center justify-between mb-3">
                   <div className="font-bold flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-red-500"></span>
                     {cat.name}
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={cat.enabled} onChange={e => {
                      const newCat = [...settings.categories];
                      newCat[idx].enabled = e.target.checked;
                      const newS = {...settings, categories: newCat};
                      setSettings(newS);
                      handleSave(newS);
                    }}/>
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-green-600 after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                   </label>
                 </div>
                 
                 {cat.enabled && (
                   <div className="space-y-3 mt-4 border-t border-slate-800 pt-3">
                     
                     <div>
                       <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Contacts Destinataires</label>
                       <div className="flex flex-wrap gap-2">
                         {contacts.map(c => (
                           <label key={c.id} className={`flex items-center gap-2 px-2 py-1 border rounded text-xs cursor-pointer transition-colors ${cat.selectedContactIds.includes(c.id) ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                             <input type="checkbox" className="hidden" checked={cat.selectedContactIds.includes(c.id)} onChange={e => {
                               const newCat = [...settings.categories];
                               if (e.target.checked) newCat[idx].selectedContactIds.push(c.id);
                               else newCat[idx].selectedContactIds = newCat[idx].selectedContactIds.filter(id => id !== c.id);
                               const newS = {...settings, categories: newCat};
                               setSettings(newS);
                               handleSave(newS);
                             }} />
                             {c.name}
                           </label>
                         ))}
                         {contacts.length === 0 && <span className="text-xs text-slate-500 italic">Aucun contact personnel configuré. Allez dans "Trusted Contacts".</span>}
                       </div>
                     </div>

                     <div>
                       <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Canaux de communication</label>
                       <div className="flex gap-4">
                         {['SMS', 'EMAIL', 'CALL'].map(channel => (
                            <label key={channel} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                              <input type="checkbox" className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
                                checked={cat.channels.includes(channel as any)}
                                onChange={e => {
                                  const newCat = [...settings.categories];
                                  if (e.target.checked) newCat[idx].channels.push(channel as any);
                                  else newCat[idx].channels = newCat[idx].channels.filter(ch => ch !== channel);
                                  const newS = {...settings, categories: newCat};
                                  setSettings(newS);
                                  handleSave(newS);
                                }}
                              />
                              {channel}
                            </label>
                         ))}
                       </div>
                     </div>

                     <div>
                       <label className="text-xs text-slate-500 uppercase font-bold mb-1 block">Modèle du message</label>
                       <textarea 
                         value={cat.messageTemplate}
                         onChange={e => {
                           const newCat = [...settings.categories];
                           newCat[idx].messageTemplate = e.target.value;
                           const newS = {...settings, categories: newCat};
                           setSettings(newS);
                         }}
                         onBlur={e => handleSave(settings)}
                         className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-indigo-500 focus:outline-none"
                         rows={3}
                       />
                       <div className="text-[10px] text-slate-500 mt-1">Variables : {'{name}, {category}, {time}, {gps_lat}, {gps_lng}, {maps_link}'}</div>
                     </div>

                   </div>
                 )}
               </div>
             ))}
           </div>
        </section>
      </div>
    </div>
  );
};
