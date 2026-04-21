import React, { useState, useEffect, useRef } from 'react';
import { SimulationState, RiskLevel, VRUType, OptimizationContext, SensorOptimizationResponse, User } from '../types';
import { simulationService } from '../services/SimulationService';
import { routingService } from '../services/RoutingService';
import { authService } from '../services/AuthService';
import { MapVisualization } from './MapVisualization';
import { MapSearchBar } from './MapSearchBar';
import { RiskScorePanel } from './RiskScorePanel';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
import { historyService } from '../services/HistoryService';
import { reportGenerator } from '../services/ReportGenerator';
import { weightOptimizer } from '../services/WeightOptimizer';
import { liveInteractionService, LiveLocation, AlertEvent } from '../services/LiveInteractionService';
import { V2XService } from '../services/V2XService';
import { incidentService } from '../services/IncidentService';
import { sosService } from '../services/SosService';
import { DENMMessage } from '../types';
import { V2XConsoleModal } from './V2XConsoleModal';
import { toast } from 'sonner';
import { SmartConditionsPanel } from './SmartConditionsPanel';
import { TripRoomPanel } from './TripRoomPanel';
import { ReportIncidentModal } from './ReportIncidentModal';
import { ReportPmrModal } from './ReportPmrModal';
import { ThumbsUp, ThumbsDown, Flag, MessageSquare, X, Navigation, Clock, Route as RouteIcon, Shield, ChevronUp, Zap, Bell, BellOff, ThermometerSun, Users, AlertTriangle } from 'lucide-react';
import { firebaseService } from '../services/FirebaseService';
import { playAlertSound } from '../utils/audio';
import { formatDuration } from '../utils/time';
import * as L from 'leaflet';

// Icons
const RadarIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ChipIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>;
const AlertIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;

interface Props {
  user: User | null;
  onLogout: () => void;
  onViewHistory: () => void;
  onViewProfile?: () => void;
  onMessages?: () => void;
  onZoneSafety?: () => void;
}

export const Dashboard: React.FC<Props> = ({ user, onLogout, onViewHistory, onViewProfile, onMessages, onZoneSafety }) => {
  const [state, setState] = useState<SimulationState | null>(null);
  const stateRef = useRef<SimulationState | null>(null); // Ref to access state in interval
  const [history, setHistory] = useState<any[]>([]);
  const [startTime] = useState(Date.now());
  const [recommendation, setRecommendation] = useState<string>("Initializing AI Sentinel...");
  const [rmseAnalysis, setRmseAnalysis] = useState<string>("");
  const [isQuantum, setIsQuantum] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dynamicZoom, setDynamicZoom] = useState(true);
  const [nearbyUsers, setNearbyUsers] = useState<LiveLocation[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<AlertEvent[]>([]);
  const [denmMessages, setDenmMessages] = useState<DENMMessage[]>([]);
  const [showV2XConsole, setShowV2XConsole] = useState(false);
  const [shownAlertIds, setShownAlertIds] = useState<Set<string>>(new Set());
  const [isSilentMode, setIsSilentMode] = useState(false);
  const [showLiveOnly, setShowLiveOnly] = useState(true);
  const isSilentModeRef = useRef(false);
  const sessionSavedRef = useRef(false);
  
  useEffect(() => {
    isSilentModeRef.current = isSilentMode;
    simulationService.setSilentMode(isSilentMode);
  }, [isSilentMode]);

  const [layerVisibility, setLayerVisibility] = useState({
    zones: false,
    vrus: true,
    sensors: true,
    sectorView: false,
    densityHeatmap: false,
    riskField: true,
    infrastructure: true,
    traffic: true,
    incidents: true
  });
  
  const [isGpsActive, setIsGpsActive] = useState(true);

  const toggleGps = () => {
    if (!isGpsActive) {
      simulationService.enableGpsMode();
      setIsGpsActive(true);
    } else {
      simulationService.disableGpsMode();
      setIsGpsActive(false);
    }
  };
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [isConditionsPanelOpen, setIsConditionsPanelOpen] = useState(false);
  const [isTripRoomOpen, setIsTripRoomOpen] = useState(false);
  const [weatherImpact, setWeatherImpact] = useState<any>(null);
  const [reportingLocation, setReportingLocation] = useState<{lat: number, lng: number} | null>(null);
  const [waitingForIncidentClick, setWaitingForIncidentClick] = useState(false);
  
  // Feedback State
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'RECOMMENDATION' | 'SIMULATION'>('RECOMMENDATION');
  const [feedbackComment, setFeedbackComment] = useState('');

  const handleFeedback = async (type: 'RECOMMENDATION' | 'SIMULATION', rating?: number) => {
    if (!user) return;
    
    setIsSubmittingFeedback(true);
    try {
      await firebaseService.saveFeedback(
        user.uid,
        type,
        rating,
        feedbackComment,
        type === 'RECOMMENDATION' ? recommendation : undefined,
        state ? { metrics: state.metrics, timestamp: state.timestamp } : undefined
      );
      toast.success('Thank you for your feedback!');
      setFeedbackComment('');
      setShowFeedbackModal(false);
    } catch (error) {
      toast.error('Failed to save feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Optimization Wizard State
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [optimizationStep, setOptimizationStep] = useState<1 | 2>(1);
  const [optContext, setOptContext] = useState<OptimizationContext>({
    weather: 'CLEAR',
    time: 'DAY',
    environment: 'OPEN_SKY'
  });
  const optContextRef = useRef(optContext); // Ref for context
  const [riskWeight, setRiskWeight] = useState<number>(50);
  
  // Live Trip Mode state
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [activeSosId, setActiveSosId] = useState<string | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<string[]>([]);
  const [activeSosMarkers, setActiveSosMarkers] = useState<any[]>([]);

  // PMR Mode
  const [pmrMode, setPmrMode] = useState(false);
  const [pmrAnalysis, setPmrAnalysis] = useState<any>(null);
  const [waitingForPmrClick, setWaitingForPmrClick] = useState(false);
  const [pmrReportingLocation, setPmrReportingLocation] = useState<{lat: number, lng: number} | null>(null);

  // Audio Guidance Mode
  const [isAudioGuidanceActive, setIsAudioGuidanceActive] = useState(false);
  const [audioVoices, setAudioVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [audioSpeed, setAudioSpeed] = useState<number>(1.0);
  const [audioLanguage, setAudioLanguage] = useState<'FR'|'EN'>('FR');
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  useEffect(() => {
    let unsub = () => {};
    import('../services/AudioGuidanceService').then(({ audioGuidanceService }) => {
      unsub = audioGuidanceService.subscribe((announcement) => {
        setLiveAnnouncement(announcement.text);
        // Clear announcement after screen readers have time to read it
        setTimeout(() => setLiveAnnouncement(''), 10000);
      });
      setAudioLanguage(audioGuidanceService.getLanguage());
      setAudioSpeed(audioGuidanceService.getRate());
      setTimeout(() => {
        setAudioVoices(audioGuidanceService.getAvailableVoices());
      }, 500); // Wait for voices to load
    });
    return () => unsub();
  }, [isAudioGuidanceActive, audioLanguage]);

  useEffect(() => {
    if (state?.route && pmrMode) {
       import('../services/PmrService').then(({ pmrService }) => {
          pmrService.analyzeRoutePMR(state.route!.coordinates).then(analysis => setPmrAnalysis(analysis));
       });
    } else {
       setPmrAnalysis(null);
    }
  }, [state?.route, pmrMode]);

  // Calculate map center from state or default
  const mapCenterLat = state?.vrus.find(v => v.isUserControlled)?.position.lat || 48.8566;
  const mapCenterLng = state?.vrus.find(v => v.isUserControlled)?.position.lng || 2.3522;

  useEffect(() => {
    // Listen to active SOS signals in 5km radius
    const unsub = sosService.subscribeToActiveSos(mapCenterLat, mapCenterLng, 5000, (alerts) => {
      setActiveSosMarkers(alerts);
      
      // Notify if new alert in my area (simple check: if not in previous state)
      alerts.forEach(alert => {
         if (!shownAlertIds.has(alert.id) && alert.userId !== user?.uid) {
           setShownAlertIds(prev => new Set(prev).add(alert.id));
           // Play sound
           if (!isSilentModeRef.current) {
             const audio = new Audio('/sounds/critical-beep.mp3');
             audio.volume = 0.5;
             audio.play().catch(e => console.log('Audio play failed:', e));
           }
           // Toast
           toast.error(
             alert.privateInfo 
               ? `EMERGENCY: ${alert.privateInfo.displayName || 'Trusted Contact'} pressed SOS nearby!`
               : `DANGER ALERT: A ${alert.vruType} nearby pressed SOS!`,
             { duration: 8000, icon: '🚨' }
           );
         }
      })
    });
    return () => unsub();
  }, [mapCenterLat, mapCenterLng]);

  const saveCurrentSession = async () => {
    if (sessionSavedRef.current || !stateRef.current || !user) return;
    sessionSavedRef.current = true;
    await historyService.saveSession({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      duration: (Date.now() - startTime) / 1000,
      user: user,
      context: optContextRef.current,
      metrics: {
        avgError: stateRef.current.metrics.avgError,
        collisionWarnings: stateRef.current.metrics.collisionWarnings,
        quantumFusionActive: stateRef.current.metrics.quantumFusionActive
      },
      summary: "Session ended."
    });
  };

  const handleRiskWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setRiskWeight(val);
    routingService.setRiskWeight(val);
    
    // Recalculate route if active
    if (state?.route && state.route.coordinates.length > 0) {
      const dest = state.route.coordinates[state.route.coordinates.length - 1];
      simulationService.setDestination(dest.lat, dest.lng);
    }
  };

  // Update refs
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    optContextRef.current = optContext;
  }, [optContext]);

  const [optimizingStatus, setOptimizingStatus] = useState<string>('');
  const [lastReasoning, setLastReasoning] = useState<string>('');

  useEffect(() => {
    simulationService.start();
    simulationService.enableGpsMode(); // Enable GPS by default
    const unsub = simulationService.subscribe((newState) => {
      setState(newState);
      setIsQuantum(newState.metrics.quantumFusionActive);
      setHistory(prev => {
        const newData = [...prev, {
          time: new Date(newState.timestamp).toLocaleTimeString(),
          error: newState.metrics.avgError,
          risk: newState.metrics.collisionWarnings
        }];
        if (newData.length > 50) newData.shift();
        return newData;
      });

      // Check for high risk events
      const criticalVRUs = newState.vrus.filter(v => v.riskLevel === RiskLevel.CRITICAL && !v.isUserControlled);
      if (criticalVRUs.length > 0) {
        const target = criticalVRUs[0];
        const description = (target.ttc !== undefined && target.collisionProbability !== undefined)
          ? `TTC: ${target.ttc.toFixed(1)}s | Prob: ${(target.collisionProbability * 100).toFixed(0)}%`
          : undefined;
        
        // Use toast for local critical alerts if not already shown recently
        // We'll rely on the nearby alerts listener for the main notifications, 
        // but keep this for immediate local feedback if needed.
        // Actually, let's just use the nearby alerts listener to avoid duplicates.
        // But the user might want immediate local feedback. Let's use toast with an ID to prevent spam.
        if (!isSilentModeRef.current) {
          playAlertSound('critical');
          toast.error(`CRITICAL COLLISION RISK: ${target.type} detected!`, {
            description,
            id: `local-critical-${target.id}`,
            duration: 5000,
            icon: '🚨',
            style: { background: '#7f1d1d', color: '#fff', borderColor: '#ef4444' }
          });
        }
      } else {
        const warningVRUs = newState.vrus.filter(v => v.riskLevel === RiskLevel.WARNING && !v.isUserControlled);
        if (warningVRUs.length > 0) {
           const target = warningVRUs[0];
           const description = (target.ttc !== undefined && target.collisionProbability !== undefined)
             ? `TTC: ${target.ttc.toFixed(1)}s | Prob: ${(target.collisionProbability * 100).toFixed(0)}%`
             : undefined;

           if (!isSilentModeRef.current) {
             playAlertSound('warning');
             toast.warning(`WARNING: ${target.type} approaching safety perimeter.`, {
               description,
               id: `local-warning-${target.id}`,
               duration: 3000,
               icon: '⚠️',
               style: { background: '#78350f', color: '#fff', borderColor: '#f59e0b' }
             });
           }
        }
      }
    });
    return () => {
      simulationService.stop();
      unsub();
      
      // Save session to history on unmount
      saveCurrentSession();
    };
  }, []);

  // Live Interaction Listener
  useEffect(() => {
    if (!state) return;
    const userVRU = state.vrus.find(v => v.isUserControlled);
    if (!userVRU) return;

    const center: [number, number] = [userVRU.position.lat, userVRU.position.lng];
    const radiusInM = 500; // 500 meters radius

    const unsubUsers = liveInteractionService.listenToNearbyUsers(center, radiusInM, (users) => {
      // Filter out self
      setNearbyUsers(users.filter(u => u.userId !== user.id));
    });

    const unsubAlerts = liveInteractionService.listenToNearbyAlerts(center, radiusInM, (alerts) => {
      setActiveAlerts(alerts);
      
      // Show toast for new alerts
      alerts.forEach(alert => {
        if (alert.id && !shownAlertIds.has(alert.id)) {
          setShownAlertIds(prev => new Set(prev).add(alert.id!));
          
          if (isSilentModeRef.current) return;

          // Determine message based on role in alert
          let message = "⚠️ Collision risk detected nearby!";
          if (alert.mainUserId === user.id) {
            message = `🚨 CRITICAL: Immediate collision risk detected for YOU with a ${alert.otherVruType || 'VRU'}!`;
          } else if (alert.otherUserId === user.id) {
            message = `🚨 CRITICAL: A ${alert.mainVruType || 'VRU'} is on a collision course with YOU!`;
          }
          
          const description = (alert.ttc !== undefined && alert.probability !== undefined) 
            ? `TTC: ${alert.ttc.toFixed(1)}s | Prob: ${(alert.probability * 100).toFixed(0)}%`
            : undefined;

          // Show alert
          if (alert.riskLevel === 'CRITICAL') {
            playAlertSound('critical');
            toast.error(message, {
              description,
              duration: 5000,
              icon: '🚨',
              style: { background: '#7f1d1d', color: '#fff', borderColor: '#ef4444' }
            });
          } else {
            playAlertSound('warning');
            toast.warning(message, {
              description,
              duration: 5000,
              icon: '⚠️',
              style: { background: '#78350f', color: '#fff', borderColor: '#f59e0b' }
            });
          }
        }
      });
    });

    const unsubDENM = V2XService.subscribeToNearbyDENM(
      { lat: center[0], lng: center[1] },
      radiusInM,
      (messages) => {
        setDenmMessages(messages);
        
        messages.forEach(msg => {
          if (!shownAlertIds.has(msg.id)) {
            setShownAlertIds(prev => new Set(prev).add(msg.id));
            
            if (isSilentModeRef.current) return;

            let toastMsg = `V2X Alert: ${msg.eventType.replace('_', ' ')}`;
            let description = `Risk: ${msg.riskLevel}`;
            
            if (msg.involvedUserIds.includes(user.id)) {
              toastMsg = `🚨 V2X CRITICAL: You are involved in a ${msg.eventType.replace('_', ' ')}!`;
              playAlertSound('critical');
              toast.error(toastMsg, {
                description,
                duration: 7000,
                icon: '📡',
                style: { background: '#7f1d1d', color: '#fff', borderColor: '#ef4444' }
              });
            } else {
              playAlertSound('warning');
              toast.warning(toastMsg, {
                description: `Nearby event detected. Stay alert.`,
                duration: 5000,
                icon: '📡',
                style: { background: '#78350f', color: '#fff', borderColor: '#f59e0b' }
              });
            }
          }
        });
      }
    );

    // Subscribe to incidents
    const bounds = L.latLngBounds(
      [center[0] - 0.05, center[1] - 0.05],
      [center[0] + 0.05, center[1] + 0.05]
    );
    incidentService.setOnIncidentsUpdate((incidents) => {
      // Trigger route recalculation if incidents change
      simulationService.recalculateRoute();
    });
    incidentService.subscribeToIncidentsInBounds(bounds);

    return () => {
      unsubUsers();
      unsubAlerts();
      unsubDENM();
    };
  }, [state?.vrus.find(v => v.isUserControlled)?.position.lat, state?.vrus.find(v => v.isUserControlled)?.position.lng]);

  // Live Journey Alerts (simulated periodic gentle alerts)
  useEffect(() => {
    if (!isLiveMode) return;
    
    // Initial gentle alert
    const initialTimer = setTimeout(() => {
      toast.custom((t) => (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-lg max-w-sm flex gap-3 pointer-events-auto">
          <div className="text-xl">🗺️</div>
          <div>
            <h4 className="text-slate-100 font-medium text-sm">Zone transition</h4>
            <p className="text-slate-400 text-xs mt-1">You are entering a well-lit segment with high community score (4.5/5).</p>
          </div>
        </div>
      ), { duration: 4000, position: 'top-right' });
      setLiveScore(95);
    }, 5000);

    const secondTimer = setTimeout(() => {
      toast.custom((t) => (
        <div className="bg-slate-900 border border-amber-700/50 p-3 rounded-lg shadow-lg max-w-sm flex gap-3 pointer-events-auto">
          <div className="text-xl">⚠️</div>
          <div>
            <h4 className="text-amber-400 font-medium text-sm">Gentle Alert : Low Traffic Area</h4>
            <p className="text-slate-300 text-xs mt-1">The upcoming street has fewer users and poor lighting. We'll monitor your journey closely.</p>
          </div>
        </div>
      ), { duration: 5000, position: 'top-right' });
      setLiveScore(60);
    }, 20000);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(secondTimer);
    };
  }, [isLiveMode]);

  // AI Advisor Logic (Background)
  useEffect(() => {
    const timer = setInterval(async () => {
       const currentState = stateRef.current;
       const currentContext = optContextRef.current;
       
       if (!currentState || !process.env.API_KEY) return;

       // Only query if there's activity or risk to save tokens, or every 15s
       const userAgent = currentState.vrus.find(v => v.isUserControlled);
       const speed = userAgent ? Math.sqrt(userAgent.velocity.x**2 + userAgent.velocity.y**2) : 0;
       
       try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `
            Role: Tactical Safety Advisor for VRU (Vulnerable Road User) Protection System.
            
            Current Telemetry:
            - VRU Type: ${userAgent?.type || 'Unknown'}
            - Speed: ${speed.toFixed(1)} m/s
            - Nearby Entities: ${currentState.metrics.totalVRUs}
            - Collision Warnings: ${currentState.metrics.collisionWarnings}
            - Environmental Context: ${currentContext.weather}, ${currentContext.time}, ${currentContext.environment}
            
            Task: Provide a single, strictly tactical, imperative safety command (max 10 words).
            Examples: "Reduce speed immediately; cross-traffic detected." or "Maintain course; sector clear."
          `;
          
          const response = await ai.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: prompt,
          });
          setRecommendation(response.text || "System nominal.");
       } catch (e: any) {
          if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
            console.warn("AI Advisor: Quota exceeded. Slowing down requests.");
            // We could clear interval here or just let it fail silently
          } else {
            console.error("AI Advisor Error:", e);
          }
          // Don't overwrite with error message to avoid UI flicker, just keep last known good or default
       }
    }, 15000); // Check every 15s to save quota

    return () => clearInterval(timer);
  }, []); // Run once on mount

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState(0);

  const [reportLanguage, setReportLanguage] = useState<'EN' | 'FR'>('EN');

  const [destinationLabel, setDestinationLabel] = useState<string | null>(null);
  const [isNavPanelVisible, setIsNavPanelVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('vru_nav_panel_visible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('vru_nav_panel_visible', JSON.stringify(isNavPanelVisible));
  }, [isNavPanelVisible]);

  const handleDestinationChange = (dest: { lat: number; lng: number; label?: string; source: 'search' | 'click' } | null) => {
    if (dest) {
      setDestinationLabel(dest.label || `Lat: ${dest.lat.toFixed(4)}, Lng: ${dest.lng.toFixed(4)}`);
    } else {
      setDestinationLabel(null);
    }
  };

  const handleExportReport = async () => {
    if (!state) return;
    setIsGeneratingReport(true);
    setReportProgress(0);

    try {
      await reportGenerator.generate({
        user,
        state,
        history,
        context: optContext,
        recommendation,
        rmseAnalysis: rmseAnalysis || "No specific analysis requested during session.",
        language: reportLanguage,
        apiKey: process.env.API_KEY,
        onProgress: setReportProgress
      });
    } catch (e) {
      console.error("Report Generation Error:", e);
      alert("Failed to generate report.");
    } finally {
      setIsGeneratingReport(false);
      setReportProgress(0);
    }
  };

  const handleAnalyzeRMSE = async () => {
    if (!state || !process.env.API_KEY) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const activeSensors = state.vrus.find(v => v.isUserControlled)?.sensors.filter(s => s.active).length || 0;
      
      const prompt = `
        Role: Senior Signal Processing Architect for VRU-Guard.
        
        System Telemetry:
        - Observed RMSE: ${state.metrics.avgError.toFixed(4)} meters.
        - Active Sensor Count (N): ${activeSensors}.
        - Fusion Mode: ${isQuantum ? 'Quantum (Heisenberg Limit)' : 'Classical (Shot Noise Limit)'}.

        Task: Provide a critical system analysis in strictly TWO concise sentences.
        1. Academically characterize the current error variance (e.g., mention stochastic noise or covariance convergence).
        2. Provide a mandatory recommendation to minimize error by explicitly suggesting to increase the number of active sensors (cardinality) to reach the quantum threshold (N > 3).
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      setRmseAnalysis(response.text || "Analysis failed.");
    } catch (e) {
      setRmseAnalysis("Could not connect to Gemini AI.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOptimizeSensors = async () => {
    if (!process.env.API_KEY) {
      alert("API KEY required for AI Optimization");
      return;
    }
    setOptimizingStatus('Consulting Gemini Quantum Model...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const userAgent = state?.vrus.find(v => v.isUserControlled);
      
      const prompt = `
        You are a Sensor Fusion Architect for a Critical Safety System.
        
        Task: Select the optimal sensor subset for a VRU (Vulnerable Road User) to minimize collision risk and power consumption while maximizing accuracy.

        VRU Profile:
        - Type: ${userAgent?.type}
        - Current Context: ${JSON.stringify(optContext)}

        Available Sensors (ID - Name):
        s1 - GPS L1 (Standard)
        s2 - GPS L5 (Precision)
        s3 - Galileo E1/E5
        s4 - GLONASS
        s5 - Velodyne LiDAR
        s6 - Stereo Camera (Front)
        s7 - Wide Cam (Rear)
        s8 - Radar (Long Range)
        s9 - UWB Anchor
        s10 - 5G V2X Sidelink

        Constraints:
        - If Weather is RAIN/FOG, optical cameras (s6, s7) degrade; prefer Radar (s8) or LiDAR (s5).
        - If Environment is URBAN_CANYON, GPS (s1, s2, s3, s4) degrades; prefer UWB (s9) or V2X (s10).
        - If Time is NIGHT, cameras degrade; prefer Active sensing (LiDAR, Radar).
        - Return a JSON object with the recommended IDs and a short reasoning.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedSensorIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              reasoning: { type: Type.STRING },
              estimatedAccuracy: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(response.text) as SensorOptimizationResponse;
      
      simulationService.applySensorConfiguration(result.recommendedSensorIds);
      setLastReasoning(result.reasoning);
      setOptimizingStatus('');
      setOptimizationStep(2); // Show success

    } catch (e) {
      console.error(e);
      setOptimizingStatus('Optimization failed. Please try again.');
    }
  };

  const openOptimizer = () => {
    setOptimizationStep(1);
    setShowOptimizer(true);
    setOptimizingStatus('');
  };

  const handleTypeChange = (type: VRUType) => {
    simulationService.setUserType(type);
    // Auto-open optimization when type changes to encourage re-calibration
    openOptimizer();
  };

  const [isOptimizingWeights, setIsOptimizingWeights] = useState(false);

  const handleOptimizeWeights = async () => {
    if (!state || !process.env.API_KEY) return;
    setIsOptimizingWeights(true);
    try {
      const currentConfig = simulationService.getRiskScoreConfig();
      const result = await weightOptimizer.optimizeWeights(
        process.env.API_KEY,
        currentConfig,
        state,
        history,
        optContext
      );

      if (result) {
        simulationService.updateRiskScoreConfig(result.config);
        // Force re-render of panel by updating state if needed, but simulationService is outside React state.
        // However, RiskScorePanel uses getRiskScoreConfig() which might not trigger re-render unless we force it.
        // We can use a dummy state update or just rely on the next tick.
        // Better: update a local state to force refresh.
        setLastReasoning(result.reasoning); // Reuse this for now or add a new one.
        alert(`Weights Optimized by AI!\n\nReasoning: ${result.reasoning}\nConfidence: ${(result.confidence * 100).toFixed(0)}%`);
      }
    } catch (e) {
      console.error("Weight optimization failed", e);
    } finally {
      setIsOptimizingWeights(false);
    }
  };

  if (!state) return <div className="text-center p-20 text-slate-500">Initializing Quantum Core...</div>;

  const userAgent = state.vrus.find(v => v.isUserControlled);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans relative">
      
      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                {feedbackType === 'RECOMMENDATION' ? <MessageSquare className="text-indigo-400" /> : <Flag className="text-orange-400" />}
                {feedbackType === 'RECOMMENDATION' ? 'Rate Recommendation' : 'Report Simulation Issue'}
              </h3>
              <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-slate-400 text-sm">
                {feedbackType === 'RECOMMENDATION' 
                  ? 'How accurate was the AI safety recommendation provided?' 
                  : 'Describe any unexpected behavior or inaccuracies in the current simulation.'}
              </p>
              
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder={feedbackType === 'RECOMMENDATION' ? "Optional comments..." : "Describe the issue..."}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
              />
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleFeedback(feedbackType)}
                  disabled={isSubmittingFeedback || (feedbackType === 'SIMULATION' && !feedbackComment.trim())}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
                >
                  {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optimization Wizard Modal */}
      {showOptimizer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
             <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 z-10">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ChipIcon /> AI SENSOR OPTIMIZER
                </h2>
                <button onClick={() => setShowOptimizer(false)} className="text-slate-400 hover:text-white">✕</button>
             </div>
             
             <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                {optimizationStep === 1 ? (
                  <>
                    <p className="text-sm text-slate-400 mb-6">
                      Configure your environment. Gemini will select the optimal sensor fusion strategy for a 
                      <span className="text-blue-400 font-bold mx-1">{userAgent?.type}</span>.
                    </p>

                    <div className="space-y-4 mb-8">
                       <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Weather Conditions</label>
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                           {['CLEAR', 'RAIN', 'FOG', 'SNOW'].map(w => (
                             <button 
                               key={w}
                               onClick={() => setOptContext({...optContext, weather: w as any})}
                               className={`py-2 rounded text-xs border ${optContext.weather === w ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                             >
                               {w}
                             </button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Time of Day</label>
                         <div className="grid grid-cols-3 gap-2">
                           {['DAY', 'NIGHT', 'DAWN/DUSK'].map(t => (
                             <button 
                               key={t}
                               onClick={() => setOptContext({...optContext, time: t as any})}
                               className={`py-2 rounded text-xs border ${optContext.time === t ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                             >
                               {t}
                             </button>
                           ))}
                         </div>
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Environment</label>
                         <div className="grid grid-cols-2 gap-2">
                           {['OPEN_SKY', 'URBAN_CANYON', 'TUNNEL', 'INDOOR'].map(e => (
                             <button 
                               key={e}
                               onClick={() => setOptContext({...optContext, environment: e as any})}
                               className={`py-2 rounded text-xs border ${optContext.environment === e ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                             >
                               {e.replace('_', ' ')}
                             </button>
                           ))}
                         </div>
                       </div>
                    </div>

                    <button 
                      onClick={handleOptimizeSensors}
                      disabled={!!optimizingStatus}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold text-white shadow-lg hover:shadow-blue-500/25 transition-all flex justify-center items-center gap-2"
                    >
                      {optimizingStatus ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {optimizingStatus}
                        </>
                      ) : (
                        "GENERATE OPTIMAL CONFIGURATION"
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Configuration Applied</h3>
                    <p className="text-sm text-slate-300 mb-6 bg-slate-800 p-4 rounded-lg border border-slate-700 text-left">
                      <span className="text-blue-400 font-bold block mb-1">AI Reasoning:</span>
                      {lastReasoning}
                    </p>
                    <button 
                      onClick={() => setShowOptimizer(false)}
                      className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-white"
                    >
                      RETURN TO DASHBOARD
                    </button>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Risk Score Panel */}
      {userAgent && (
        <RiskScorePanel 
          vru={userAgent}
          config={simulationService.getRiskScoreConfig()}
          onConfigChange={(config) => simulationService.updateRiskScoreConfig(config)}
          isOpen={showRiskPanel}
          onToggle={() => setShowRiskPanel(!showRiskPanel)}
          onOptimize={handleOptimizeWeights}
          isOptimizing={isOptimizingWeights}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[3990] md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-[4000] bg-slate-950 border-r border-slate-800/50 flex flex-col overflow-hidden transition-all duration-300 ease-in-out shadow-2xl
        md:relative md:translate-x-0 md:shadow-none
        ${isSidebarOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full w-[280px]'}
        ${isSidebarCollapsed ? 'md:w-16' : 'md:w-[280px]'}
      `}>
        <div className="p-4 border-b border-slate-800/50 shrink-0 flex justify-between items-center bg-slate-900/50 relative">
          {!isSidebarCollapsed ? (
            <div className="flex flex-col overflow-hidden whitespace-nowrap">
              <h1 className="text-xl font-bold tracking-tighter text-white flex items-center gap-2">
                <span className="shrink-0 w-3 h-3 bg-blue-500 rounded-full animate-pulse"/>
                VRU-GUARD
              </h1>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">SENTINEL VERSION 2.5</p>
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <span className="shrink-0 w-3 h-3 bg-blue-500 rounded-full animate-pulse"/>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex text-slate-400 hover:text-white transition-colors"
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <svg className={`w-5 h-5 transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* User Info Card */}
        {user && (
          <div 
            onClick={onViewProfile}
            className={`mx-4 mt-4 p-3 bg-slate-900/40 rounded-lg border border-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-800/60 transition-colors group ${isSidebarCollapsed ? 'px-0' : 'gap-3'}`}
            title={isSidebarCollapsed ? 'View Profile' : undefined}
          >
             <div className="w-10 h-10 shrink-0 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg group-hover:scale-105 transition-transform">
                {user.name.charAt(0).toUpperCase()}
             </div>
             {!isSidebarCollapsed && (
               <>
                 <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">{user.name}</div>
                    <div className="text-xs text-slate-400 truncate">{user.organization}</div>
                    <div className={`text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded w-fit ${user.role === 'ADMIN' ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30' : 'bg-slate-700 text-slate-300'}`}>
                      {user.role}
                    </div>
                 </div>
                 <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
               </>
             )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

          {/* Controls - VRU Type */}
          <details className="bg-slate-900/40 rounded-lg border border-slate-800 group" open={!isSidebarCollapsed}>
            <summary className="flex items-center justify-between p-3 cursor-pointer text-slate-400 hover:text-white transition-colors">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {!isSidebarCollapsed && <span className="text-xs font-bold uppercase tracking-wider">Agent Config</span>}
              </div>
              {!isSidebarCollapsed && <svg className="w-4 h-4 opacity-50 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
            </summary>
            {!isSidebarCollapsed && (
              <div className="px-3 pb-4 pt-1">
                <div className="grid grid-cols-2 gap-2 mb-2">
              {Object.values(VRUType).filter(t => t !== VRUType.VEHICLE).map(type => (
                <button
                  key={type}
                  onClick={() => {
                     handleTypeChange(type);
                     routingService.setVruType(type);
                     // Recalculate route if active
                     if (state?.route && state.route.coordinates.length > 0) {
                        const dest = state.route.coordinates[state.route.coordinates.length - 1];
                        simulationService.setDestination(dest.lat, dest.lng);
                     }
                  }}
                  className={`text-xs py-2 px-2 rounded border ${userAgent?.type === type ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                >
                  {type}
                </button>
              ))}
            </div>
              </div>
            )}
          </details>

          {/* Controls - Sensors */}
          <details className="bg-slate-900/40 rounded-lg border border-slate-800 group" open={!isSidebarCollapsed}>
            <summary className="flex items-center justify-between p-3 cursor-pointer text-slate-400 hover:text-white transition-colors">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                {!isSidebarCollapsed && <span className="text-xs font-bold uppercase tracking-wider">Sensor Fusion</span>}
              </div>
              {!isSidebarCollapsed && <svg className="w-4 h-4 opacity-50 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
            </summary>
            {!isSidebarCollapsed && (
              <div className="px-3 pb-4 pt-1">
            <div className="flex justify-end items-center mb-3">
               {user?.role === 'ADMIN' && (
                 <button 
                   onClick={openOptimizer}
                   className="text-[10px] bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-500/30 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                 >
                   <ChipIcon /> AI OPTIMIZE
                 </button>
               )}
            </div>
            
            <div className="space-y-1 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {userAgent?.sensors.map(sensor => (
                <label key={sensor.id} className="flex items-start justify-between p-2 rounded hover:bg-slate-800/50 cursor-pointer group transition-colors border-b border-slate-800/50 last:border-0">
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={sensor.active} 
                        onChange={() => simulationService.toggleUserSensor(sensor.id)}
                        className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20" 
                      />
                      <span className={`text-xs font-medium ${sensor.active ? 'text-slate-200' : 'text-slate-500'}`}>{sensor.name}</span>
                    </div>
                    {/* Live Lat/Lng Display */}
                    {sensor.active && sensor.reading && (
                        <div className="pl-6 text-[10px] font-mono text-slate-400 flex flex-col">
                            <span>Lat: {sensor.reading.lat.toFixed(6)}</span>
                            <span>Lng: {sensor.reading.lng.toFixed(6)}</span>
                        </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400 whitespace-nowrap">±{sensor.accuracy}m</span>
                </label>
              ))}
            </div>
             {userAgent?.sensors.filter(s => s.active).length && userAgent.sensors.filter(s => s.active).length >= 3 ? (
               <div className="mt-3 text-[10px] text-quantum-400 text-center font-mono border border-quantum-500/30 rounded py-1 bg-quantum-500/10">
                 QUANTUM THRESHOLD MET
               </div>
             ) : (
                <div className="mt-3 text-[10px] text-slate-500 text-center font-mono border border-slate-700 rounded py-1">
                 CLASSICAL FUSION ONLY
               </div>
             )}
              </div>
            )}
          </details>

          {/* View Settings & Overlays */}
          <details className="bg-slate-900/40 rounded-lg border border-slate-800 group" open={!isSidebarCollapsed}>
            <summary className="flex items-center justify-between p-3 cursor-pointer text-slate-400 hover:text-white transition-colors">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                {!isSidebarCollapsed && <span className="text-xs font-bold uppercase tracking-wider">Map Overlays</span>}
              </div>
              {!isSidebarCollapsed && <svg className="w-4 h-4 opacity-50 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
            </summary>
            {!isSidebarCollapsed && (
              <div className="px-3 pb-4 pt-1">
             <div className="space-y-3">
               <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs text-slate-300 group-hover:text-white transition-colors">Dynamic Auto-Zoom</span>
                  <div 
                    onClick={() => setDynamicZoom(!dynamicZoom)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${dynamicZoom ? 'bg-blue-600' : 'bg-slate-700'}`}
                  >
                     <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${dynamicZoom ? 'left-6' : 'left-1'}`} />
                  </div>
               </label>
               
               <div className="h-px bg-slate-700/50 my-2" />
               
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.zones}
                    onChange={(e) => setLayerVisibility({...layerVisibility, zones: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">Risk Zones</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.vrus}
                    onChange={(e) => setLayerVisibility({...layerVisibility, vrus: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">VRU Entities</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.sensors}
                    onChange={(e) => setLayerVisibility({...layerVisibility, sensors: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">Sensor Rays</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.sectorView}
                    onChange={(e) => setLayerVisibility({...layerVisibility, sectorView: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">Sector View (90°)</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.densityHeatmap}
                    onChange={(e) => setLayerVisibility({...layerVisibility, densityHeatmap: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">Density Heatmap</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.riskField}
                    onChange={(e) => setLayerVisibility({...layerVisibility, riskField: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">Probabilistic Risk Field (Grid)</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.infrastructure}
                    onChange={(e) => setLayerVisibility({...layerVisibility, infrastructure: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">Infrastructure Zones</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.traffic}
                    onChange={(e) => setLayerVisibility({...layerVisibility, traffic: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">Real-Time Traffic</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={layerVisibility.incidents}
                    onChange={(e) => setLayerVisibility({...layerVisibility, incidents: e.target.checked})}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200">Reported Incidents</span>
               </label>
             </div>
              </div>
            )}
          </details>

          <details className="bg-slate-900/40 rounded-lg border border-slate-800 group" open={!isSidebarCollapsed}>
            <summary className="flex items-center justify-between p-3 cursor-pointer text-slate-400 hover:text-white transition-colors">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {!isSidebarCollapsed && <span className="text-xs font-bold uppercase tracking-wider">Tracking & Logic</span>}
              </div>
              {!isSidebarCollapsed && <svg className="w-4 h-4 opacity-50 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
            </summary>
            {!isSidebarCollapsed && (
              <div className="px-3 pb-4 pt-1 flex flex-col gap-2">
               <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300">Location Tracking</span>
                  <button 
                    onClick={toggleGps}
                    className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 transition-colors border ${isGpsActive ? 'bg-green-600/20 text-green-400 border-green-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {isGpsActive ? 'GPS ACTIVE' : 'ENABLE GPS'}
                  </button>
               </div>
               {state?.lastGpsError && (
                 <div className="text-[10px] text-red-400 bg-red-950/30 p-1 border border-red-900/50 rounded">
                   GPS Error: {state.lastGpsError}
                 </div>
               )}
               
               <div className="flex justify-between items-center mt-2">
                 <span className="text-xs text-slate-300" aria-label="Audio Guidance for visually impaired">Audio Guidance</span>
                 <button
                   aria-pressed={isAudioGuidanceActive}
                   onClick={() => {
                     import('../services/AudioGuidanceService').then(({ audioGuidanceService }) => {
                       const newState = !isAudioGuidanceActive;
                       audioGuidanceService.setEnabled(newState);
                       setIsAudioGuidanceActive(newState);
                     });
                   }}
                   className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500 ${isAudioGuidanceActive ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}
                 >
                   {isAudioGuidanceActive ? '🔊 ON' : '🔈 OFF'}
                 </button>
               </div>
               
               {isAudioGuidanceActive && (
                 <div className="flex flex-col gap-2 mt-2 bg-slate-800/50 p-2 rounded border border-slate-700/50">
                   {/* Language selection */}
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] text-slate-400">Language:</span>
                     <div className="flex gap-1">
                       {['FR', 'EN'].map(lang => (
                         <button
                           key={lang}
                           onClick={() => import('../services/AudioGuidanceService').then(({audioGuidanceService}) => { 
                             audioGuidanceService.setLanguage(lang as 'FR'|'EN');
                             setAudioLanguage(lang as 'FR'|'EN');
                             setTimeout(() => setAudioVoices(audioGuidanceService.getAvailableVoices()), 100);
                           })}
                           className={`text-[10px] px-2 py-1 rounded border transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${audioLanguage === lang ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                           aria-label={`Set language to ${lang}`}
                         >
                           {lang}
                         </button>
                       ))}
                     </div>
                   </div>

                   {/* Voice selection */}
                   {audioVoices.length > 0 && (
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400">Voice:</span>
                       <select 
                         aria-label="Select voice"
                         className="text-[10px] bg-slate-800 border border-slate-600 text-slate-300 rounded px-1 py-1 max-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                         value={selectedVoiceURI}
                         onChange={(e) => {
                           const uri = e.target.value;
                           setSelectedVoiceURI(uri);
                           import('../services/AudioGuidanceService').then(({audioGuidanceService}) => {
                             audioGuidanceService.setVoice(uri);
                           });
                         }}
                       >
                         {audioVoices.map(v => (
                           <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                         ))}
                       </select>
                     </div>
                   )}

                   {/* Speed selection */}
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] text-slate-400">Speed:</span>
                     <div className="flex gap-1">
                       {[0.8, 1.0, 1.2].map(speed => (
                         <button
                           key={speed}
                           onClick={() => import('../services/AudioGuidanceService').then(({audioGuidanceService}) => { 
                             audioGuidanceService.setRate(speed);
                             setAudioSpeed(speed);
                           })}
                           className={`text-[10px] px-2 py-1 rounded border transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${audioSpeed === speed ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                           aria-label={`Set speed to ${speed}x`}
                         >
                           {speed}x
                         </button>
                       ))}
                     </div>
                   </div>
                   
                   {/* Accessible Announcement Region */}
                   <div aria-live="assertive" className="sr-only">
                      {liveAnnouncement}
                   </div>
                 </div>
               )}
               {isGpsActive && state?.vrus.find(v => v.isUserControlled) && (
                 <div className="bg-slate-900/50 rounded p-2 border border-slate-700/50 flex flex-col gap-1">
                   <div className="flex justify-between text-[10px]">
                     <span className="text-slate-400">LAT:</span>
                     <span className="text-slate-200 font-mono">{state.vrus.find(v => v.isUserControlled)?.position.lat.toFixed(6)}</span>
                   </div>
                   <div className="flex justify-between text-[10px]">
                     <span className="text-slate-400">LNG:</span>
                     <span className="text-slate-200 font-mono">{state.vrus.find(v => v.isUserControlled)?.position.lng.toFixed(6)}</span>
                   </div>
                   {state.lastGpsError && (
                     <div className="text-[10px] text-red-400 mt-1">
                       Error: {state.lastGpsError}
                     </div>
                   )}
                 </div>
               )}
             </div>
           )}
         </details>

         <details className="bg-slate-900/40 rounded-lg border border-slate-800 group" open={!isSidebarCollapsed}>
           <summary className="flex items-center justify-between p-3 cursor-pointer text-slate-400 hover:text-white transition-colors">
             <div className="flex items-center gap-2">
               <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
               {!isSidebarCollapsed && <span className="text-xs font-bold uppercase tracking-wider">Session Tools</span>}
             </div>
             {!isSidebarCollapsed && <svg className="w-4 h-4 opacity-50 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
           </summary>
           {!isSidebarCollapsed && (
             <div className="px-3 pb-4 pt-1 space-y-2">

          {/* Export Button */}
          <div className="space-y-2 mb-2">
            <div className="flex bg-slate-900/40 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setReportLanguage('EN')}
                className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${reportLanguage === 'EN' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                ENGLISH
              </button>
              <button
                onClick={() => setReportLanguage('FR')}
                className={`flex-1 py-1 text-[10px] font-bold rounded transition-colors ${reportLanguage === 'FR' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                FRANÇAIS
              </button>
            </div>
            
            <button 
              onClick={handleExportReport}
              disabled={history.length === 0 || isGeneratingReport}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGeneratingReport ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {reportLanguage === 'FR' ? `GÉNÉRATION... ${reportProgress.toFixed(0)}%` : `GENERATING... ${reportProgress.toFixed(0)}%`}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  {reportLanguage === 'FR' ? 'EXPORTER RAPPORT (PDF)' : 'EXPORT SAFETY REPORT (PDF)'}
                </>
              )}
            </button>
          </div>

          <div className="h-px bg-slate-700/50 my-2" />

          {/* Live tracking overlay controls */}
          <div className="mb-4">
             <button
               onClick={() => {
                 setIsLiveMode(!isLiveMode);
                 if (!isLiveMode) {
                   toast.success("Live Safe Journey started");
                 } else {
                   toast.info("Live mode ended");
                 }
               }}
               className={`w-full py-2 border rounded text-xs transition-colors flex items-center justify-center gap-2 mb-2 ${
                 isLiveMode 
                   ? 'bg-red-900/30 border-red-500/50 text-red-400 hover:bg-red-900/50' 
                   : 'bg-indigo-900/30 border-indigo-500/50 text-indigo-400 hover:bg-indigo-900/50'
               }`}
            >
               {isLiveMode ? (
                 <>
                   <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
                   END LIVE JOURNEY
                 </>
               ) : (
                 <>
                   <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                   START LIVE JOURNEY
                 </>
               )}
            </button>
            
            {isLiveMode && (
              <div className="mt-2 text-xs">
                 {activeSosId ? (
                   <button 
                     onClick={async () => {
                       await sosService.resolveSos(activeSosId);
                       setActiveSosId(null);
                       toast.success("SOS Alert cancelled. Stay safe!", { duration: 3000 });
                     }}
                     className="w-full mt-2 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded flex justify-center items-center gap-2 animate-pulse"
                   >
                     <Shield className="w-3 h-3" /> I'M SAFE NOW
                   </button>
                 ) : (
                   <button 
                    onClick={async () => {
                      if (!state?.vrus.find(v => v.isUserControlled)) {
                        toast.error("Waiting for GPS signal...");
                        return;
                      }
                      const userVru = state.vrus.find(v => v.isUserControlled);
                      const myLat = userVru?.position.lat || mapCenterLat;
                      const myLng = userVru?.position.lng || mapCenterLng;
                      try {
                        const id = await sosService.triggerSos(myLat, myLng, userVru?.type || 'Pedestrian');
                        setActiveSosId(id);
                        toast.error("EMERGENCY ALERT BROADCASTED. Trusted Contacts notified with exact location.", { 
                          duration: 8000,
                          icon: '🚨',
                          style: { background: '#7f1d1d', color: '#fff', borderColor: '#ef4444' }
                        });
                      } catch (e) {
                         toast.error("Failed to send SOS.");
                      }
                    }}
                    className="w-full mt-2 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded flex justify-center items-center gap-2"
                   >
                     <Shield className="w-3 h-3" /> FEELING IN DANGER (SOS)
                   </button>
                 )}
              </div>
            )}
          </div>
        </div>
        )}
      </details>
      </div>

      <div className={`mt-auto pt-4 space-y-2 border-t border-slate-800 p-4 ${isSidebarCollapsed ? 'px-2 pb-4' : 'pb-4'}`}>
        {/* Messages Button */}
          {onMessages && (
            <button 
              onClick={onMessages}
              className={`w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 mb-2 ${isSidebarCollapsed ? 'px-0' : ''}`}
              title={isSidebarCollapsed ? 'Messages' : undefined}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && 'MESSAGES'}
            </button>
          )}

          {/* Zone Safety Button */}
          {onZoneSafety && (
            <button 
              onClick={onZoneSafety}
              className={`w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 mb-2 ${isSidebarCollapsed ? 'px-0' : ''}`}
              title={isSidebarCollapsed ? 'Sécurité par Zone' : undefined}
            >
              <Shield className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && 'SÉCURITÉ PAR ZONE'}
            </button>
          )}

          {/* History Button */}
          <button 
            onClick={onViewHistory}
            className={`w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 mb-2 ${isSidebarCollapsed ? 'px-0' : ''}`}
            title={isSidebarCollapsed ? 'View Session History' : undefined}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {!isSidebarCollapsed && 'VIEW SESSION HISTORY'}
          </button>

          {/* V2X Console Button */}
          <button 
            onClick={() => setShowV2XConsole(true)}
            className={`w-full py-2 bg-slate-800 hover:bg-indigo-900/30 hover:text-indigo-400 border border-slate-700 rounded text-xs text-slate-400 transition-colors flex items-center justify-center gap-2 mb-2 ${isSidebarCollapsed ? 'px-0' : ''}`}
            title={isSidebarCollapsed ? 'V2X Console' : undefined}
          >
            <span className="shrink-0">📡</span>
            {!isSidebarCollapsed && 'V2X CONSOLE'}
          </button>

          {/* Report Issue Button */}
          <button 
            onClick={() => {
              setFeedbackType('SIMULATION');
              setShowFeedbackModal(true);
            }}
            className={`w-full py-2 bg-slate-800 hover:bg-orange-900/30 hover:text-orange-400 border border-slate-700 rounded text-xs text-slate-400 transition-colors flex items-center justify-center gap-2 mb-2 ${isSidebarCollapsed ? 'px-0' : ''}`}
            title={isSidebarCollapsed ? 'Report Issue' : undefined}
          >
            <Flag size={14} className="shrink-0" />
            {!isSidebarCollapsed && 'REPORT ISSUE'}
          </button>

          {/* Logout Button */}
          <button 
            onClick={onLogout}
            className={`w-full py-2 bg-slate-800 hover:bg-red-900/30 hover:text-red-400 border border-slate-700 rounded text-xs text-slate-400 transition-colors flex items-center justify-center gap-2 ${isSidebarCollapsed ? 'px-0' : ''}`}
            title={isSidebarCollapsed ? 'Disconnect' : undefined}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {!isSidebarCollapsed && 'DISCONNECT'}
          </button>
          </div>

        </div>

      {showV2XConsole && (
        <V2XConsoleModal onClose={() => setShowV2XConsole(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        {/* Top Bar */}
        <div className="h-16 border-b border-slate-800 flex items-center px-4 md:px-6 justify-between bg-slate-900/50 backdrop-blur shrink-0 gap-4 relative z-[2000]">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="md:hidden text-slate-400 hover:text-white"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>

             <div className="flex items-center gap-2 px-3 py-1 bg-green-900/20 border border-green-500/30 rounded text-green-400 text-xs font-medium whitespace-nowrap">
               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               <span className="hidden sm:inline">LIVE FEED</span>
               <span className="sm:hidden">LIVE</span>
             </div>
             
             <button
               onClick={() => setIsSilentMode(!isSilentMode)}
               className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-medium transition-colors border ${
                 isSilentMode 
                   ? 'bg-slate-800 text-slate-400 border-slate-700' 
                   : 'bg-blue-900/20 text-blue-400 border-blue-500/30'
               }`}
               title={isSilentMode ? "Enable Notifications" : "Silent Mode"}
             >
               {isSilentMode ? <BellOff size={14} /> : <Bell size={14} />}
               <span className="hidden sm:inline">{isSilentMode ? 'SILENT' : 'NOTIFICATIONS ON'}</span>
             </button>

             <button
               onClick={() => setShowLiveOnly(!showLiveOnly)}
               className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-medium transition-colors border ${
                 showLiveOnly 
                   ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' 
                   : 'bg-slate-800 text-slate-400 border-slate-700'
               }`}
               title={showLiveOnly ? "Afficher tous les utilisateurs" : "Masquer les utilisateurs fictifs"}
             >
               <Users size={14} />
               <span className="hidden sm:inline">{showLiveOnly ? 'RÉELS SEULEMENT' : 'TOUS LES UTILISATEURS'}</span>
             </button>

             {state.metrics.collisionWarnings > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs font-medium animate-pulse whitespace-nowrap">
                <AlertIcon />
                <span className="hidden sm:inline">COLLISION RISK DETECTED</span>
                <span className="sm:hidden">RISK</span>
              </div>
             )}
          </div>
          <div className="flex items-center gap-4 overflow-hidden">
             
             {isLiveMode && (
               <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-red-900/30 border border-red-500/50 rounded-lg text-white font-bold animate-pulse">
                 <div className="w-2 h-2 rounded-full bg-red-400"></div>
                 LIVE JOURNEY ACTIVE
               </div>
             )}

             {/* Gemini Recommendation Snippet */}
             <div className="hidden lg:flex items-center gap-2 text-xs text-indigo-300 bg-indigo-900/20 px-3 py-1 rounded border border-indigo-500/20 truncate">
                <ChipIcon />
                <span className="truncate max-w-[300px]">{recommendation}</span>
                <div className="flex items-center gap-2 ml-2 border-l border-indigo-500/20 pl-2">
                  <button 
                    onClick={() => handleFeedback('RECOMMENDATION', 5)} 
                    className="hover:text-green-400 transition-colors p-0.5"
                    title="Accurate recommendation"
                  >
                    <ThumbsUp size={12} />
                  </button>
                  <button 
                    onClick={() => handleFeedback('RECOMMENDATION', 1)} 
                    className="hover:text-red-400 transition-colors p-0.5"
                    title="Inaccurate recommendation"
                  >
                    <ThumbsDown size={12} />
                  </button>
                </div>
             </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 md:gap-6 overflow-y-auto lg:overflow-hidden">
          {/* Main Map - Spans 2 cols, 2 rows on desktop */}
          <div className="col-span-1 lg:col-span-2 lg:row-span-2 relative min-h-[500px] lg:min-h-0 h-[60vh] lg:h-auto glass-panel rounded-2xl overflow-hidden shadow-2xl">
            <MapVisualization 
               state={state} 
               dynamicZoom={dynamicZoom} 
               layerVisibility={layerVisibility} 
               nearbyUsers={nearbyUsers} 
               activeAlerts={activeAlerts} 
               activeSosMarkers={activeSosMarkers}
               denmMessages={denmMessages} 
               onDestinationChange={handleDestinationChange}
               reportingLocation={pmrReportingLocation ? null : reportingLocation}
               setReportingLocation={(loc) => { if(!waitingForPmrClick) setReportingLocation(loc); }}
               waitingForIncidentClick={waitingForIncidentClick}
               setWaitingForIncidentClick={setWaitingForIncidentClick}
               showLiveOnly={showLiveOnly}
               pmrAnalysis={pmrAnalysis}
             />

             {/* Modals placed absolutely over the map area */}
             {reportingLocation && (
               <ReportIncidentModal 
                 location={reportingLocation} 
                 onClose={() => setReportingLocation(null)}
                 onReported={() => setReportingLocation(null)}
               />
             )}
             
             {pmrReportingLocation && (
               <ReportPmrModal 
                 location={pmrReportingLocation!}
                 onClose={() => setPmrReportingLocation(null)}
                 onReported={() => {
                   setPmrReportingLocation(null);
                   if (state?.route && pmrMode) {
                     import('../services/PmrService').then(({ pmrService }) => {
                        pmrService.analyzeRoutePMR(state.route!.coordinates).then(analysis => setPmrAnalysis(analysis));
                     });
                   }
                 }}
               />
             )}
             
             {/* Unified Navigation Panel */}
             <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
               <div className="flex gap-2 pointer-events-auto">
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setIsTripRoomOpen(!isTripRoomOpen);
                   }}
                   className={`bg-slate-900/90 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-colors ${isTripRoomOpen ? 'text-indigo-400 bg-slate-800' : 'text-white hover:bg-slate-800'}`}
                 >
                   <MessageSquare size={16} className={isTripRoomOpen ? 'text-indigo-400' : 'text-indigo-300'} />
                   <span className="text-sm font-medium hidden sm:inline">TripRoom</span>
                 </button>
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setIsConditionsPanelOpen(!isConditionsPanelOpen);
                   }}
                   className={`relative bg-slate-900/90 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-colors ${isConditionsPanelOpen ? 'text-blue-400 bg-slate-800' : 'text-white hover:bg-slate-800'}`}
                 >
                   <ThermometerSun size={16} className={isConditionsPanelOpen ? 'text-blue-400' : 'text-amber-400'} />
                   <span className="text-sm font-medium hidden sm:inline">Conditions</span>
                   {weatherImpact && (weatherImpact.slippery === 'High' || weatherImpact.heat === 'High' || weatherImpact.visibility === 'High' || weatherImpact.wind === 'High') && (
                     <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
                   )}
                 </button>
                 {!isNavPanelVisible && (
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       setIsNavPanelVisible(true);
                     }}
                     className="bg-slate-900/90 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-white hover:bg-slate-800 transition-colors"
                   >
                     <Navigation size={16} className="text-blue-400" />
                     <span className="text-sm font-medium hidden sm:inline">Show Navigation</span>
                   </button>
                 )}
               </div>
               
               <div className="pointer-events-auto w-full flex flex-col gap-2">
                 <TripRoomPanel 
                   isOpen={isTripRoomOpen} 
                   onClose={() => setIsTripRoomOpen(false)} 
                   userLocation={state?.vrus.find(v => v.isUserControlled)?.geolocation?.current || null}
                   tripId={state?.route ? 'active-trip' : undefined}
                   onConvertToIncident={(msg) => {
                     if (typeof window !== 'undefined' && (window as any).toast) {
                       (window as any).toast.info("Cliquez sur la carte pour placer l'incident");
                     }
                     setWaitingForIncidentClick(true);
                     setIsTripRoomOpen(false);
                   }}
                 />

                 <SmartConditionsPanel 
                   isOpen={isConditionsPanelOpen} 
                   onClose={() => setIsConditionsPanelOpen(false)} 
                   userLocation={state?.vrus.find(v => v.isUserControlled)?.geolocation?.current || null}
                   mapCenter={state?.vrus.find(v => v.isUserControlled)?.position || { lat: 48.8566, lng: 2.3522 }}
                   destination={state?.route ? state.route.coordinates[state.route.coordinates.length - 1] : null}
                   onImpactChange={setWeatherImpact}
                 />

                 {isNavPanelVisible && (
                 <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl max-w-sm w-full flex flex-col gap-3 transition-all">
                   <div className="flex items-center justify-between">
                     <h3 className="text-white font-semibold flex items-center gap-2">
                       <Navigation size={18} className="text-blue-400" />
                       Navigation
                     </h3>
                     <div className="flex items-center gap-2">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setIsNavPanelVisible(false);
                         }}
                         className="text-slate-400 hover:text-white transition-colors p-1"
                         title="Hide Navigation"
                       >
                         <ChevronUp size={16} />
                       </button>
                       {state?.route && (
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             simulationService.clearRoute();
                             setDestinationLabel(null);
                           }}
                           className="text-slate-400 hover:text-white transition-colors p-1"
                           title="Clear Route"
                         >
                           <X size={16} />
                         </button>
                       )}
                     </div>
                   </div>

                   <MapSearchBar 
                     initialQuery={destinationLabel || ''}
                     onDestinationChange={(dest) => {
                       if (dest) {
                         simulationService.setDestination(dest.lat, dest.lng);
                       } else {
                         simulationService.clearRoute();
                       }
                       handleDestinationChange(dest);
                     }} 
                   />
                   
                   {state?.route && (
                     <>
                       <div className="grid grid-cols-2 gap-3 mt-1">
                         <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                           <div className="text-xs text-slate-400 flex items-center gap-1 mb-1"><Clock size={12}/> ETA</div>
                           <div className="text-lg font-mono text-white">
                             {formatDuration(state.route.duration)}
                           </div>
                         </div>
                         <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                           <div className="text-xs text-slate-400 flex items-center gap-1 mb-1"><RouteIcon size={12}/> Distance</div>
                           <div className="text-lg font-mono text-white">
                             {state.route.distance > 1000 ? (state.route.distance / 1000).toFixed(1) + ' km' : Math.round(state.route.distance) + ' m'}
                           </div>
                         </div>
                       </div>

                       {/* Route Type Toggle */}
                       {state.alternativeRoutes && state.alternativeRoutes.length > 0 && (
                         <div className="flex gap-2 mt-1">
                           <button 
                             className={`flex-1 py-2 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${state.route.type === 'SAFEST' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
                             onClick={(e) => {
                               e.stopPropagation();
                               if (state.route?.type !== 'SAFEST') {
                                 const safeRoute = state.alternativeRoutes?.find(r => r.type === 'SAFEST');
                                 if (safeRoute) simulationService.selectRoute(safeRoute);
                               }
                             }}
                           >
                             <Shield size={14} /> Safest
                           </button>
                           <button 
                             className={`flex-1 py-2 px-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${state.route.type === 'FASTEST' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}
                             onClick={(e) => {
                               e.stopPropagation();
                               if (state.route?.type !== 'FASTEST') {
                                 const fastRoute = state.alternativeRoutes?.find(r => r.type === 'FASTEST');
                                 if (fastRoute) simulationService.selectRoute(fastRoute);
                               }
                             }}
                           >
                             <Zap size={14} /> Fastest
                           </button>
                         </div>
                       )}

                       {/* PMR Accessibility Toggle */}
                       <div className="mt-2 group">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setPmrMode(!pmrMode); }}
                           className={`w-full py-2 px-3 rounded-lg flex items-center justify-between text-sm transition-all border ${pmrMode ? 'bg-[#1d4ed8]/20 border-blue-500 text-blue-300' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                         >
                           <div className="flex items-center gap-2 font-medium">
                             <span className="text-lg">♿</span> 
                             Accessibilité PMR
                           </div>
                           <div className={`w-8 h-4 rounded-full transition-colors relative ${pmrMode ? 'bg-blue-500' : 'bg-slate-600'}`}>
                              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${pmrMode ? 'left-[18px]' : 'left-0.5'}`}></div>
                           </div>
                         </button>
                         {pmrMode && pmrAnalysis && (
                           <div className="mt-2 p-3 bg-slate-900/60 rounded-md border border-slate-700">
                              <p className="text-xs text-slate-300">
                                {pmrAnalysis.isAccessible 
                                   ? "✅ Ce trajet est compatible avec les fauteuils roulants." 
                                   : "⚠️ Attention : Ce trajet comporte des obstacles ou des passages difficiles."}
                              </p>
                              {!pmrAnalysis.isAccessible && pmrAnalysis.obstacles && (
                                <ul className="text-xs text-slate-400 mt-2 ml-4 list-disc space-y-1">
                                  {pmrAnalysis.obstacles.slice(0, 3).map((obs: any, i: number) => (
                                    <li key={i}>{obs.type} {obs.description ? `- ${obs.description}` : ''}</li>
                                  ))}
                                  {pmrAnalysis.obstacles.length > 3 && <li>...et {pmrAnalysis.obstacles.length - 3} autres.</li>}
                                </ul>
                              )}
                           </div>
                         )}
                       </div>

                       {/* Audio Guidance Toggle */}
                       <div className="mt-2 group">
                         <button 
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             import('../services/AudioGuidanceService').then(({ audioGuidanceService }) => {
                               const newState = !isAudioGuidanceActive;
                               audioGuidanceService.setEnabled(newState);
                               setIsAudioGuidanceActive(newState);
                             });
                           }}
                           className={`w-full py-2 px-3 rounded-lg flex items-center justify-between text-sm transition-all border ${isAudioGuidanceActive ? 'bg-[#1d4ed8]/20 border-blue-500 text-blue-300' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                         >
                           <div className="flex items-center gap-2 font-medium">
                             <span className="text-lg">🔊</span> 
                             Guidage Audio
                           </div>
                           <div className={`w-8 h-4 rounded-full transition-colors relative ${isAudioGuidanceActive ? 'bg-blue-500' : 'bg-slate-600'}`}>
                              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isAudioGuidanceActive ? 'left-[18px]' : 'left-0.5'}`}></div>
                           </div>
                         </button>
                       </div>
                       
                       {pmrMode && pmrAnalysis && (
                           <div className="mt-2 bg-slate-950 rounded-lg border border-slate-800 p-3 text-xs shadow-inner animate-in fade-in slide-in-from-top-2 duration-200">
                             <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-slate-300">Statut Global:</span>
                                <span className={`px-2 py-0.5 rounded-full font-bold ${pmrAnalysis.globalStatus === 'ADAPTE' ? 'bg-green-500/20 text-green-400' : pmrAnalysis.globalStatus === 'PARTIELLEMENT_ADAPTE' ? 'bg-orange-500/20 text-orange-400' : pmrAnalysis.globalStatus === 'NON_ADAPTE' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                  {pmrAnalysis.globalStatus.replace(/_/g, ' ')}
                                </span>
                             </div>
                             <div className="grid grid-cols-2 gap-2 mt-3">
                                <div className="text-center bg-slate-900 rounded p-1.5 border border-slate-800/50">
                                   <div className="text-lg text-white font-mono">{pmrAnalysis.accessiblePercentage}%</div>
                                   <div className="text-[10px] text-slate-500 uppercase tracking-wide">Accessible</div>
                                </div>
                                <div className="text-center bg-slate-900 rounded p-1.5 border border-slate-800/50">
                                   <div className="text-lg text-amber-400 font-mono">{pmrAnalysis.totalObstacles}</div>
                                   <div className="text-[10px] text-slate-500 uppercase tracking-wide">Obstacles</div>
                                </div>
                             </div>
                             
                             {pmrAnalysis.totalObstacles > 0 && (
                               <div className="mt-3 pt-2 border-t border-slate-800">
                                  <div className="text-[10px] text-slate-400 mb-1">Derniers obstacles détectés:</div>
                                  <ul className="space-y-1">
                                    {pmrAnalysis.segments.flatMap(s => s.obstacles).slice(0, 3).map((obs, i) => (
                                      <li key={i} className="text-orange-300 text-[11px] truncate flex items-center gap-1.5 bg-orange-500/5 border border-orange-500/10 px-1.5 py-1 rounded">
                                        <AlertTriangle size={10} />
                                        {obs.description}
                                      </li>
                                    ))}
                                  </ul>
                               </div>
                             )}
                             
                             {pmrAnalysis.globalStatus === 'INCONNU' && (
                                <div className="mt-2 text-[10px] text-slate-500 italic bg-slate-900 p-2 rounded">
                                  Information insuffisante sur certaines zones. Contribuez pour améliorer la carte.
                                </div>
                             )}

                             {state.vrus.find(v => v.isUserControlled) && (
                               <button 
                                 onClick={() => {
                                    if (typeof window !== 'undefined' && (window as any).toast) {
                                      (window as any).toast.info("Cliquez sur la carte pour placer un signalement PMR");
                                    }
                                    setWaitingForPmrClick(true);
                                 }}
                                 className="mt-3 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-xs font-medium border border-slate-700 transition-colors"
                               >
                                 Signaler un obstacle PMR
                               </button>
                             )}
                           </div>
                         )}

                       </>
                     )}
                   </div>
                 )}
                </div>
               </div>
            </div>

          {/* Analytics - Right Col */}
          <div className="col-span-1 glass-panel rounded-2xl p-5 flex flex-col min-h-[350px] lg:min-h-0">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <RadarIcon /> Real-time Error (RMSE)
                </h3>
                <span className="text-xl font-mono text-blue-400">{state.metrics.avgError.toFixed(4)}m</span>
             </div>
             
             <div className="flex-1 min-h-0 mb-4 bg-slate-950/50 rounded-xl p-2 border border-slate-800/50">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={history}>
                   <defs>
                     <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                   <XAxis dataKey="time" hide />
                   <YAxis stroke="#475569" fontSize={10} domain={[0, 'auto']} />
                   <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#94a3b8' }}
                   />
                   <Area type="monotone" dataKey="error" stroke="#3b82f6" fillOpacity={1} fill="url(#colorError)" isAnimationActive={false} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>

             {/* AI Explanation Section */}
             <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/50 flex flex-col gap-3 shadow-inner">
                <div className="flex justify-between items-center">
                   <h4 className="text-xs font-bold text-slate-400 tracking-wider">X-AI RMSE ANALYSIS</h4>
                   <button 
                    onClick={handleAnalyzeRMSE}
                    disabled={!process.env.API_KEY || isAnalyzing}
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-md text-white disabled:opacity-50 font-medium transition-colors shadow-lg shadow-indigo-500/20"
                   >
                     {isAnalyzing ? 'Thinking...' : 'EXPLAIN'}
                   </button>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed min-h-[60px]">
                  {rmseAnalysis ? rmseAnalysis : "Click explain to analyze current signal integrity..."}
                </p>
             </div>
          </div>

           <div className="col-span-1 glass-panel rounded-2xl p-5 flex flex-col min-h-[300px] lg:min-h-0">
             <h3 className="text-sm font-semibold text-slate-300 mb-4">Risk Density Profile</h3>
             <div className="flex-1 min-h-0 bg-slate-950/50 rounded-xl p-2 border border-slate-800/50">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={history}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                   <XAxis dataKey="time" hide />
                   <YAxis stroke="#475569" fontSize={10} />
                   <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                   />
                   <Line type="step" dataKey="risk" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;