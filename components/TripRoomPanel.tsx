import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, AlertTriangle, Info, HelpCircle, MapPin, X } from 'lucide-react';
import { tripRoomService } from '../services/TripRoomService';
import { TripMessage } from '../types';
import { auth } from '../firebase';
import * as geofire from 'geofire-common';

interface TripRoomPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  tripId?: string;
  onConvertToIncident?: (message: TripMessage) => void;
}

export const TripRoomPanel: React.FC<TripRoomPanelProps> = ({
  isOpen,
  onClose,
  userLocation,
  tripId,
  onConvertToIncident
}) => {
  const [activeTab, setActiveTab] = useState<'trip' | 'nearby'>(tripId ? 'trip' : 'nearby');
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const initRoom = async () => {
      setLoading(true);
      try {
        let roomId: string;
        if (activeTab === 'trip' && tripId) {
          roomId = await tripRoomService.getOrCreateTripRoom(tripId);
        } else {
          // Nearby room based on geohash (precision 4 ~ 39km x 19km, precision 5 ~ 4.9km x 4.9km)
          const lat = userLocation ? userLocation.lat : 48.8566;
          const lng = userLocation ? userLocation.lng : 2.3522;
          const zoneKey = geofire.geohashForLocation([lat, lng]).substring(0, 5);
          roomId = await tripRoomService.getOrCreateZoneRoom(zoneKey);
        }
        
        setCurrentRoomId(roomId);
        
        tripRoomService.subscribeToMessages(roomId, (newMessages) => {
          setMessages(newMessages);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        });
      } catch (error) {
        console.error("Failed to init TripRoom", error);
      } finally {
        setLoading(false);
      }
    };

    initRoom();
  }, [isOpen, activeTab, tripId, userLocation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentRoomId) return;

    const text = inputText.trim();
    setInputText('');
    
    let type: 'info' | 'warning' | 'question' = 'info';
    if (text.toLowerCase().includes('attention') || text.toLowerCase().includes('danger') || text.toLowerCase().includes('bloqué')) {
      type = 'warning';
    } else if (text.includes('?')) {
      type = 'question';
    }

    try {
      await tripRoomService.sendMessage(currentRoomId, text, type);
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full sm:w-80 h-[400px] sm:h-[500px] max-h-[60vh] bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">TripRoom</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-2 gap-1 bg-slate-800/30">
        <button
          onClick={() => setActiveTab('trip')}
          disabled={!tripId}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'trip' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Trajet Actif
        </button>
        <button
          onClick={() => setActiveTab('nearby')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'nearby' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Autour de moi
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Connexion à la room...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs text-center px-4">
            Aucun message pour le moment. Soyez le premier à partager une info !
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === auth.currentUser?.uid;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="text-[10px] text-slate-400 mb-0.5 px-1">
                  {isMe ? 'Vous' : msg.displayName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div 
                  className={`relative max-w-[85%] p-2.5 rounded-2xl text-sm ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-tr-sm' 
                      : msg.messageType === 'warning' 
                        ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30 rounded-tl-sm'
                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!isMe && msg.messageType === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                    {!isMe && msg.messageType === 'info' && <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />}
                    {!isMe && msg.messageType === 'question' && <HelpCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />}
                    <span className="break-words">{msg.text}</span>
                  </div>
                  
                  {!isMe && msg.messageType === 'warning' && onConvertToIncident && (
                    <button 
                      onClick={() => onConvertToIncident(msg)}
                      className="mt-2 text-[10px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Convertir en incident
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-slate-800/50 border-t border-slate-700">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Partager une info trafic..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            maxLength={250}
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || !auth.currentUser}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        {!auth.currentUser && (
          <div className="text-[10px] text-amber-400 mt-1 text-center">
            Connectez-vous pour participer à la discussion
          </div>
        )}
      </div>
    </div>
  );
};
