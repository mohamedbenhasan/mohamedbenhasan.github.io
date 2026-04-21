import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Route as RouteIcon, Info, MessageSquare, AlertTriangle, ShieldCheck, Search, User } from 'lucide-react';
import { zoneSafetyService, ZoneStats, ZoneReview } from '../services/ZoneSafetyService';
import { routingService } from '../services/RoutingService';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

// We'll simulate a map view here, or use actual Leaflet map inside this page if possible.
// For the sake of this separate page without complex Leaflet context setup duplication,
// we could leverage form inputs for route planning and simulate the map part, 
// OR just build a functional UI that relies on the routing service.

interface ZoneSafetyPageProps {
  onBack?: () => void;
}

export default function ZoneSafetyPage({ onBack }: ZoneSafetyPageProps) {
  const [activeTab, setActiveTab] = useState<'evaluate' | 'route' | 'community'>('evaluate');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  
  // Evaluation state
  const [activeGeohash, setActiveGeohash] = useState<string>('');
  const [zoneStats, setZoneStats] = useState<ZoneStats | null>(null);
  const [zoneReviews, setZoneReviews] = useState<ZoneReview[]>([]);
  const [loadingZone, setLoadingZone] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  
  // Routing state
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [routeStats, setRouteStats] = useState<{hash: string, stats: ZoneStats | null}[]>([]);
  const [isRouting, setIsRouting] = useState(false);

  // New review state
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [timeContext, setTimeContext] = useState<'day'|'night'|'unknown'>('unknown');
  
  const [reviewers, setReviewers] = useState<Record<string, string>>({});
  
  // Community Routes state
  const [communityRoutes, setCommunityRoutes] = useState<any[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [showProposeRoute, setShowProposeRoute] = useState(false);
  
  // Propose route state
  const [propStart, setPropStart] = useState('');
  const [propEnd, setPropEnd] = useState('');
  const [propMode, setPropMode] = useState<'walk' | 'transport' | 'bike'>('walk');
  const [propTimeContext, setPropTimeContext] = useState<'day' | 'night' | 'always'>('day');
  const [propReasons, setPropReasons] = useState<string[]>([]);
  const [isSubmittingRoute, setIsSubmittingRoute] = useState(false);

  useEffect(() => {
    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentLocation(loc);
          if (!activeGeohash) {
            handleSelectLocation(loc.lat, loc.lng);
          }
        },
        console.warn
      );
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'community') {
      fetchCommunityRoutes();
    }
  }, [activeTab]);

  const fetchCommunityRoutes = async () => {
    setLoadingRoutes(true);
    try {
      const routes = await zoneSafetyService.getCommunityRoutes();
      setCommunityRoutes(routes);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleVoteRoute = async (routeId: string, vote: 1 | -1) => {
    try {
      await zoneSafetyService.voteOnRoute(routeId, vote);
      fetchCommunityRoutes(); // refresh
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectLocation = async (lat: number, lng: number) => {
    const hash = zoneSafetyService.getGeohashForLocation(lat, lng);
    setActiveGeohash(hash);
    fetchZoneData(hash);
  };

  const fetchZoneData = async (hash: string) => {
    setLoadingZone(true);
    try {
      const stats = await zoneSafetyService.getZoneStats(hash);
      const reviews = await zoneSafetyService.getZoneReviews(hash);
      setZoneStats(stats);
      setZoneReviews(reviews);
      
      // Fetch reviewer names
      const reviewerIds = [...new Set(reviews.filter(r => !r.isAnonymous).map(r => r.userId))];
      const newReviewers: Record<string, string> = { ...reviewers };
      for (const uid of reviewerIds) {
        if (!newReviewers[uid]) {
          const docSnap = await getDoc(doc(db, 'public_profiles', uid));
          if (docSnap.exists()) {
            newReviewers[uid] = docSnap.data().displayName || 'Utilisateur';
          } else {
            newReviewers[uid] = 'Utilisateur';
          }
        }
      }
      setReviewers(newReviewers);
      
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingZone(false);
    }
  };

  const submitReview = async () => {
    if (!activeGeohash) return;
    
    try {
      await zoneSafetyService.submitReview({
        geohash: activeGeohash,
        isAnonymous,
        rating: newRating,
        comment: newComment,
        tags: newTags,
        timeContext
      });
      
      // Reset and reload
      setShowReviewForm(false);
      setNewComment('');
      setNewRating(5);
      setNewTags([]);
      fetchZoneData(activeGeohash);
      
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'envoi de l'avis");
    }
  };

  const handleProposeRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propStart || !propEnd) return;
    
    setIsSubmittingRoute(true);
    try {
      // Simulate real geocoding and getting geohashes for the route
      const mockRouteHashes = ['u09tvm', 'u09tvq', 'u09tvr'];
      
      await zoneSafetyService.submitCommunityRoute({
        startAddress: propStart,
        endAddress: propEnd,
        routePoints: [{lat: 48.8566, lng: 2.3522}, {lat: 48.8568, lng: 2.3524}], // fake points
        geohashes: mockRouteHashes,
        timeContext: propTimeContext,
        mode: propMode,
        reasons: propReasons
      });
      
      setShowProposeRoute(false);
      setPropStart('');
      setPropEnd('');
      setPropReasons([]);
      fetchCommunityRoutes();
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la proposition de route.");
    } finally {
      setIsSubmittingRoute(false);
    }
  };

  const calculateRouteSafety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startQuery || !endQuery) return;
    
    setIsRouting(true);
    try {
      // Very basic simulated geocoding
      // In a real scenario we use Nominatim or Google Places
      // For now, let's just create a mock route between two random points if we can't geocode
      // As routingService might be complex to use here without map component, we simulate route hashes
      
      // Attempt to use the existing routing service logic
      // But Since routingService expects `from` and `to` coords, and we have strings...
      // We'll fake it for the prototype if geocoding is hard, OR we can generate a simulated route
      const mockRouteHashes = ['u09tvm', 'u09tvq', 'u09tvr', 'u09tww', 'u09twx'];
      
      const statsMap = await zoneSafetyService.getMultipleZoneStats(mockRouteHashes);
      
      setRouteStats(mockRouteHashes.map(h => ({
        hash: h,
        stats: statsMap[h] || null
      })));
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsRouting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setNewTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans pt-16 flex-col">
      <div className="border-b border-slate-800 bg-slate-900/50 p-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            Sécurité par Zone
          </h1>
        </div>
        
        <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('evaluate')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'evaluate' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hidden sm:block'}`}
          >
            Évaluer une zone
          </button>
          <button 
            onClick={() => setActiveTab('route')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'route' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Itinéraire
          </button>
          <button 
            onClick={() => setActiveTab('community')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'community' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Routes Communauté
          </button>
        </div>
      </div>
      
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-500 flex items-center justify-center gap-2 shrink-0">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Ce score est basé sur des avis utilisateurs et ne garantit pas la sécurité absolue. Soyez toujours vigilant.
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
        {activeTab === 'evaluate' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
              <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-indigo-400" />
                  Zone sélectionnée
                </h2>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={activeGeohash}
                    onChange={(e) => {
                      setActiveGeohash(e.target.value);
                      if (e.target.value.length >= 5) fetchZoneData(e.target.value);
                    }}
                    placeholder="Saisissez un Geohash (ex: u09tvm)"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button 
                    onClick={() => currentLocation && handleSelectLocation(currentLocation.lat, currentLocation.lng)}
                    className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors border border-slate-700"
                    title="Ma position actuelle"
                  >
                    <MapPin className="w-5 h-5 text-blue-400" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-[url('https://picsum.photos/seed/map/800/600?blur=2')] bg-cover bg-center relative">
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"></div>
                
                <div className="z-10 bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl min-w-[300px] text-center">
                  <div className="text-sm font-mono text-slate-400 mb-1">GEOHASH ZONE</div>
                  <div className="text-3xl font-bold tracking-wider text-white mb-6 uppercase">{activeGeohash || '---'}</div>
                  
                  {loadingZone ? (
                    <div className="text-slate-400 animate-pulse">Chargement...</div>
                  ) : zoneStats ? (
                    <div>
                      <div className="flex items-end justify-center gap-2 mb-2">
                        <span className="text-5xl font-bold text-amber-400">{zoneStats.averageRating.toFixed(1)}</span>
                        <span className="text-xl text-slate-500 mb-1">/ 5</span>
                      </div>
                      <div className="flex justify-center mb-2">
                        {[1,2,3,4,5].map(star => (
                          <Star key={star} className={`w-5 h-5 ${star <= Math.round(zoneStats.averageRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                        ))}
                      </div>
                      <div className="text-sm text-slate-400">{zoneStats.reviewCount} avis utilisateur{zoneStats.reviewCount > 1 ? 's' : ''}</div>
                    </div>
                  ) : (
                    <div className="text-slate-400 p-4 bg-slate-800/50 rounded-lg">
                      <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      Pas encore d'évaluation pour cette zone.
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setShowReviewForm(true)}
                    disabled={!activeGeohash}
                    className="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-3 rounded-xl transition-all"
                  >
                    Donner mon avis
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col h-[600px]">
              {showReviewForm ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
                    Créer un avis
                    <button onClick={() => setShowReviewForm(false)} className="text-slate-400 hover:text-white"><ArrowLeft className="w-5 h-5"/></button>
                  </h3>
                  
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Note de sécurité globale</label>
                      <div className="flex gap-2 shrink-0">
                        {[1,2,3,4,5].map(star => (
                          <button 
                            key={star} 
                            onClick={() => setNewRating(star)}
                            className="p-1"
                          >
                            <Star className={`w-8 h-8 ${star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700 hover:text-slate-600'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Tags (Optionnel)</label>
                      <div className="flex flex-wrap gap-2">
                        {['Vol', 'Agression', 'Harcèlement', 'Arnaque', 'Bien éclairé', 'Sécurisé', 'Police présente'].map(tag => (
                          <button 
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${newTags.includes(tag) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Moment</label>
                        <select 
                          value={timeContext} 
                          onChange={(e) => setTimeContext(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="unknown">Non spécifié</option>
                          <option value="day">En Journée</option>
                          <option value="night">De Nuit</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                          <input 
                            type="checkbox" 
                            checked={isAnonymous} 
                            onChange={e => setIsAnonymous(e.target.checked)}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                          />
                          Publier anonymement
                        </label>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Tags (Optionnels)</label>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {['Vol', 'Agression', 'Harcèlement', 'Arnaque', 'Éclairage', 'Transport'].map(tag => (
                          <button
                            key={tag}
                            onClick={() => {
                              if (newTags.includes(tag)) {
                                setNewTags(newTags.filter(t => t !== tag));
                              } else {
                                setNewTags([...newTags, tag]);
                              }
                            }}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              newTags.includes(tag) 
                                ? 'bg-indigo-600 border-indigo-500 text-white' 
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">Commentaire (Optionnel)</label>
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Partagez votre expérience dans cette zone..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 min-h-[120px] resize-none"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-4 mt-auto border-t border-slate-800">
                    <button 
                      onClick={submitReview}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg transition-all"
                    >
                      Publier l'avis
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
                  <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center shrink-0">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-400" />
                      Avis récents
                    </h3>
                    <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded text-slate-400">
                      {zoneReviews.length} avis
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    {loadingZone ? (
                       <div className="p-6 text-center text-slate-500">Chargement...</div>
                    ) : zoneReviews.length === 0 ? (
                       <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
                         <Info className="w-10 h-10 mb-3 opacity-20" />
                         <p>Soyez le premier à évaluer cette zone !</p>
                       </div>
                    ) : (
                      <div className="divide-y divide-slate-800/50">
                        {zoneReviews.map(review => (
                          <div key={review.id} className="p-5 hover:bg-slate-800/30 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                  <User className="w-4 h-4 text-slate-400" />
                                </div>
                                <div>
                                  <div className="font-medium text-sm text-slate-200">
                                    {review.isAnonymous ? 'Anonyme' : (reviewers[review.userId] || 'Utilisateur')}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="flex bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                {[1,2,3,4,5].map(star => (
                                  <Star key={star} className={`w-3 h-3 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-800'}`} />
                                ))}
                              </div>
                            </div>
                            
                            {review.comment && (
                              <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">{review.comment}</p>
                            )}
                            
                            {(review.tags && review.tags.length > 0) || review.timeContext !== 'unknown' ? (
                              <div className="flex flex-wrap gap-2 mt-4">
                                {review.timeContext !== 'unknown' && (
                                  <span className="text-[10px] px-2 py-1 rounded bg-indigo-900/30 text-indigo-400 border border-indigo-500/20">
                                    {review.timeContext === 'day' ? 'En journée' : 'De nuit'}
                                  </span>
                                )}
                                {review.tags?.map(tag => (
                                  <span key={tag} className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROUTE TAB */}
        {activeTab === 'route' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col">
               <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                 <RouteIcon className="w-5 h-5 text-indigo-400" />
                 Planifier un trajet
               </h2>
               
               <form onSubmit={calculateRouteSafety} className="space-y-4">
                 <div>
                   <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Point de départ</label>
                   <input 
                     type="text" 
                     value={startQuery}
                     onChange={e => setStartQuery(e.target.value)}
                     placeholder="Adresse ou 'Ma position'"
                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none"
                     required
                   />
                 </div>
                 
                 <div className="flex justify-center -my-2 relative z-10">
                   <div className="bg-slate-800 p-1.5 rounded-full border border-slate-700 text-slate-400">
                     <ArrowLeft className="w-4 h-4 rotate-90" />
                   </div>
                 </div>
                 
                 <div>
                   <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Destination</label>
                   <input 
                     type="text" 
                     value={endQuery}
                     onChange={e => setEndQuery(e.target.value)}
                     placeholder="Adresse d'arrivée"
                     className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none"
                     required
                   />
                 </div>
                 
                 <div className="pt-4 border-t border-slate-800">
                   <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Préférences (Bêta)</label>
                   <div className="flex flex-col gap-2">
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                       <input type="checkbox" className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500" />
                       Éviter les parcs de nuit
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                       <input type="checkbox" className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500" defaultChecked />
                       Préférer les rues éclairées
                     </label>
                   </div>
                 </div>

                 <button 
                  type="submit"
                  disabled={isRouting}
                  className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {isRouting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin" />
                      Calcul en cours...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Analyser le trajet
                    </>
                  )}
                </button>
               </form>
            </div>
            
            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[600px]">
              <div className="p-5 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
                <h3 className="font-semibold text-white">Analyse des zones traversées</h3>
                {routeStats.length > 0 && (
                  <span className="text-sm px-3 py-1 bg-slate-950 rounded-full border border-slate-700 text-slate-300">
                    {routeStats.length} zones
                  </span>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
                {routeStats.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500">
                    <RouteIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p>Saisissez un point de départ et d'arrivée pour analyser la sécurité de l'itinéraire.</p>
                  </div>
                ) : (
                  <div className="space-y-4 relative">
                    <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-800"></div>
                    
                    {routeStats.map((item, index) => {
                      const isLowRated = item.stats && item.stats.averageRating < 2.5;
                      const isHighRated = item.stats && item.stats.averageRating >= 4.0;
                      
                      return (
                        <div key={index} className="relative z-10 flex items-start gap-4 pl-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-4 border-slate-950 ${
                            !item.stats ? 'bg-slate-600' :
                            isLowRated ? 'bg-red-500' :
                            isHighRated ? 'bg-green-500' :
                            'bg-amber-400'
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          </div>
                          
                          <div className={`flex-1 rounded-xl p-4 border ${
                            !item.stats ? 'bg-slate-900/50 border-slate-800' :
                            isLowRated ? 'bg-red-500/10 border-red-500/20' :
                            isHighRated ? 'bg-green-500/10 border-green-500/20' :
                            'bg-amber-500/10 border-amber-500/20'
                          }`}>
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-medium text-slate-200">
                                Segment {index + 1} <span className="text-xs text-slate-500 ml-2 font-mono uppercase">#{item.hash}</span>
                              </h4>
                              {item.stats && (
                                <div className="flex flex-col gap-1 items-end">
                                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded text-xs">
                                    <Star className={`w-3 h-3 ${isLowRated ? 'text-red-400 fill-red-400' : isHighRated ? 'text-green-400 fill-green-400' : 'text-amber-400 fill-amber-400'}`} />
                                    <span className="font-bold text-white">{item.stats.averageRating.toFixed(1)}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <span className={`w-1.5 h-1.5 rounded-full ${item.stats.reviewCount > 10 ? 'bg-green-500' : item.stats.reviewCount > 3 ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                                    <span>Fiabilité {item.stats.reviewCount > 10 ? 'Haute' : item.stats.reviewCount > 3 ? 'Moyenne' : 'Faible'}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {item.stats ? (
                              <p className="text-sm text-slate-400 mt-1">
                                {item.stats.reviewCount} avis recensé{item.stats.reviewCount > 1 ? 's' : ''} dans cette zone.
                                {isLowRated && <span className="block mt-2 text-red-400 font-medium text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Zone à risque signalée ! Soyez prudent.</span>}
                              </p>
                            ) : (
                              <p className="text-sm text-slate-500 italic mt-1">Pas encore d'avis pour cette zone.</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COMMUNITY ROUTES TAB */}
        {activeTab === 'community' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[700px]">
             <div className="p-6 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-indigo-400" />
                    Routes recommandées par la communauté
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">Découvrez et votez pour les itinéraires les plus sûrs.</p>
                </div>
                <button 
                  onClick={() => setShowProposeRoute(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  Proposer un itinéraire
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950">
               {showProposeRoute ? (
                 <div className="max-w-2xl mx-auto">
                   <button onClick={() => setShowProposeRoute(false)} className="text-slate-400 hover:text-white mb-6 flex items-center gap-2 text-sm">
                     <ArrowLeft className="w-4 h-4" /> Retour aux routes
                   </button>
                   <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                     <h3 className="text-lg font-medium text-white mb-6">Proposer un itinéraire sûr</h3>
                     <form onSubmit={handleProposeRoute} className="space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                           <label className="block text-sm font-medium text-slate-400 mb-1">Départ</label>
                           <input type="text" required value={propStart} onChange={e => setPropStart(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none" placeholder="Ex: Gare du Nord" />
                         </div>
                         <div>
                           <label className="block text-sm font-medium text-slate-400 mb-1">Arrivée</label>
                           <input type="text" required value={propEnd} onChange={e => setPropEnd(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none" placeholder="Ex: Châtelet" />
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                           <label className="block text-sm font-medium text-slate-400 mb-1">Mode de transport</label>
                           <select value={propMode} onChange={e => setPropMode(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none">
                             <option value="walk">À pied</option>
                             <option value="bike">À vélo / trottinette</option>
                             <option value="transport">Transports en commun</option>
                           </select>
                         </div>
                         <div>
                           <label className="block text-sm font-medium text-slate-400 mb-1">Moment recommandé</label>
                           <select value={propTimeContext} onChange={e => setPropTimeContext(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none">
                             <option value="always">Jour et Nuit</option>
                             <option value="day">Plutôt de Jour</option>
                             <option value="night">Sûr même de Nuit</option>
                           </select>
                         </div>
                       </div>
                       
                       <div>
                         <label className="block text-sm font-medium text-slate-400 mb-2">Pourquoi cette route est-elle sûre ?</label>
                         <div className="flex flex-wrap gap-2">
                           {['Bien éclairé', 'Très fréquenté', 'Présence policière', 'Caméras', 'Commerces ouverts', 'Route large'].map(reason => (
                             <button
                               key={reason}
                               type="button"
                               onClick={() => setPropReasons(prev => prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason])}
                               className={`px-3 py-1 rounded-full text-xs transition-colors border ${
                                 propReasons.includes(reason) 
                                   ? 'bg-indigo-600 border-indigo-500 text-white' 
                                   : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                               }`}
                             >
                               {reason}
                             </button>
                           ))}
                         </div>
                       </div>
                       
                       <button
                         type="submit"
                         disabled={isSubmittingRoute}
                         className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4"
                       >
                         {isSubmittingRoute ? 'Envoi en cours...' : 'Partager à la communauté'}
                       </button>
                     </form>
                   </div>
                 </div>
               ) : loadingRoutes ? (
                 <div className="flex justify-center items-center h-full text-slate-500 animate-pulse">Chargement des routes...</div>
               ) : communityRoutes.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <RouteIcon className="w-16 h-16 mb-4 opacity-20" />
                  <h3 className="text-lg font-medium text-slate-400">Aucune route recommandée par ici.</h3>
                  <p className="text-sm mt-2 max-w-md text-center">Soyez le premier à proposer un itinéraire sûr pour aider la communauté !</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 gap-4">
                   {communityRoutes.map(route => (
                     <div key={route.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                       <div className="flex justify-between items-start mb-4">
                         <div>
                           <div className="flex items-center gap-2 text-white font-medium mb-1">
                             <MapPin className="w-4 h-4 text-indigo-400" />
                             {route.startAddress} <span className="text-slate-500 mx-1">→</span> {route.endAddress}
                           </div>
                           <div className="flex gap-2 mt-2">
                             <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-400">
                               {route.mode === 'walk' ? 'À Pied' : route.mode === 'bike' ? 'À Vélo' : 'Transports'}
                             </span>
                             <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-indigo-900/30 text-indigo-400">
                               {route.timeContext === 'day' ? 'De Jour' : route.timeContext === 'night' ? 'De Nuit' : 'Jour & Nuit'}
                             </span>
                           </div>
                         </div>
                         <div className="flex flex-col items-center bg-slate-950 rounded-lg p-2 border border-slate-800">
                           <button onClick={() => handleVoteRoute(route.id, 1)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-green-400">
                             <ArrowLeft className="w-4 h-4 rotate-90" />
                           </button>
                           <span className={`font-mono text-sm font-bold my-1 ${route.upvotes - route.downvotes > 0 ? 'text-green-400' : route.upvotes - route.downvotes < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                             {route.upvotes - route.downvotes}
                           </span>
                           <button onClick={() => handleVoteRoute(route.id, -1)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400">
                             <ArrowLeft className="w-4 h-4 -rotate-90" />
                           </button>
                         </div>
                       </div>
                       
                       {route.reasons && route.reasons.length > 0 && (
                         <div className="mt-4 pt-4 border-t border-slate-800/50 flex flex-wrap gap-2">
                           {route.reasons.map((reason: string) => (
                             <span key={reason} className="text-[11px] px-2 py-1 rounded-full bg-slate-800/50 text-slate-300 border border-slate-700/50 flex items-center gap-1">
                               <Star className="w-3 h-3 text-amber-500" />
                               {reason}
                             </span>
                           ))}
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
