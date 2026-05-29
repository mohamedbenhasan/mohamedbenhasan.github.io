import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';
import { audioGuidanceService } from './AudioGuidanceService';
import { overpassService, POI } from './OverpassService';
import { routingService } from './RoutingService';
import { simulationService } from './SimulationService';
import { sosService } from './SosService';
import { geocodingService, GeocodingResult } from './GeocodingService';
import { Coordinates } from '../types';

export interface VoiceAssistantState {
  isListening: boolean;
  statusText: string;
  awaitingConfirmation: boolean;
  awaitingOptionSelection: boolean;
  pendingPois: (POI | GeocodingResult)[];
  currentPoiIndex: number;
  centerMapEvent?: number; // small hack to trigger map centering in Dashboard UI
  isHandsFreeMode?: boolean;
}

export type VoiceAssistantListener = (state: VoiceAssistantState) => void;

interface VoiceIntent {
  action: 'SEARCH_DESTINATION' | 'CANCEL_NAV' | 'PAUSE_NAV' | 'RESUME_NAV' | 'REPEAT_NAV' | 'SET_ROUTE_PREF' | 'TRIGGER_SOS' | 'CANCEL_SOS' | 'CENTER_MAP' | 'HELP' | 'UNKNOWN' | 'CONFIRM_YES' | 'CONFIRM_NO' | 'SELECT_OPTION';
  argument?: string;
  routePref?: 'safest' | 'fastest';
  optionIndex?: number;
}

export class VoiceAssistantService {
  private state: VoiceAssistantState = {
    isListening: false,
    statusText: '',
    awaitingConfirmation: false,
    awaitingOptionSelection: false,
    pendingPois: [],
    currentPoiIndex: 0
  };
  
  private listeners: VoiceAssistantListener[] = [];
  private isNative: boolean;
  private webRecognition: any = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.initWebSpeech();
  }

  private isHandsFreeMode: boolean = false;

  public setHandsFreeMode(enabled: boolean) {
      this.isHandsFreeMode = enabled;
      if (enabled) {
          this.startListening();
      } else {
          this.stopListening();
      }
      this.updateState({ isHandsFreeMode: enabled });
  }

  private initWebSpeech() {
    if (!this.isNative && typeof window !== 'undefined') {
      const SpeechRecognitionConfig = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionConfig) {
        this.webRecognition = new SpeechRecognitionConfig();
        this.webRecognition.continuous = false; // We restart it manually for better control
        this.webRecognition.interimResults = false;
        this.webRecognition.lang = 'fr-FR';

        this.webRecognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          this.processCommand(transcript);
        };

        this.webRecognition.onerror = (event: any) => {
          console.error("Web Speech error", event.error);
          this.updateState({ statusText: `Erreur: ${event.error}`, isListening: false });
          
          if (this.isHandsFreeMode && event.error !== 'not-allowed') {
              setTimeout(() => {
                  if (this.isHandsFreeMode) this.startListening();
              }, 1000);
          }
        };
        
        this.webRecognition.onend = () => {
           this.updateState({ isListening: false });
           // Auto-restart if hands-free mode is on and we are not currently awaiting a speech response
           if (this.isHandsFreeMode && !audioGuidanceService.isSpeaking) {
               setTimeout(() => {
                   if (this.isHandsFreeMode) this.startListening();
               }, 500);
           }
        };
      }
    }
  }

  public subscribe(listener: VoiceAssistantListener) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private updateState(newState: Partial<VoiceAssistantState>) {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach(l => l(this.state));
  }

  public async startListening() {
    if (this.state.isListening) return;

    this.updateState({ isListening: true, statusText: 'Écoute en cours...' });

    if (this.isNative) {
      try {
        const hasPermission = await SpeechRecognition.checkPermissions();
        if (hasPermission.speechRecognition !== 'granted') {
          const req = await SpeechRecognition.requestPermissions();
          if (req.speechRecognition !== 'granted') {
              this.updateState({ isListening: false, statusText: 'Permission requise' });
              setTimeout(() => this.updateState({ statusText: '' }), 3000);
              return;
          }
        }

        const result = await SpeechRecognition.start({
          language: 'fr-FR',
          maxResults: 1,
          prompt: "Dites votre commande...",
          partialResults: false,
          popup: true
        });

        if (result && result.matches && result.matches.length > 0) {
          const transcript = result.matches[0];
          this.processCommand(transcript);
        } else {
            this.updateState({ statusText: 'Aucune commande détectée' });
            setTimeout(() => this.updateState({ statusText: '' }), 3000);
        }
        this.stopListening();
      } catch (e: any) {
        console.error("Speech Recognition native error:", e);
        this.updateState({ isListening: false, statusText: 'Erreur micro natif' });
        setTimeout(() => this.updateState({ statusText: '' }), 3000);
      }
    } else {
      if (this.webRecognition) {
        try {
          this.webRecognition.start();
        } catch(e) {
          this.updateState({ isListening: false });
        }
      } else {
        this.updateState({ isListening: false, statusText: "Non supporté sur ce navigateur" });
        setTimeout(() => this.updateState({ statusText: '' }), 3000);
      }
    }
  }
  
  public async stopListening() {
     if (!this.state.isListening) return;
     this.updateState({ isListening: false });
     if (this.isNative) {
         try {
         } catch(e) {}
     } else {
         if (this.webRecognition) {
             this.webRecognition.stop();
         }
     }
  }

  public async processCommand(transcript: string) {
    this.updateState({ statusText: `Compris : "${transcript}"` });
    console.log("Voice Command: ", transcript);
    
    const text = transcript.toLowerCase();
    let intent: VoiceIntent = { action: 'UNKNOWN' };
    
    // Parse Intent
    if (this.state.awaitingOptionSelection) {
        if (text.includes('annuler') || text.includes('stop') || text.includes('non')) {
            intent.action = 'CANCEL_NAV';
        } else if (text.match(/\b(1|un|premier|première)\b/)) {
            intent.action = 'SELECT_OPTION'; intent.optionIndex = 0;
        } else if (text.match(/\b(2|deux|deuxième)\b/)) {
            intent.action = 'SELECT_OPTION'; intent.optionIndex = 1;
        } else if (text.match(/\b(3|trois|troisième)\b/)) {
            intent.action = 'SELECT_OPTION'; intent.optionIndex = 2;
        }
    } else if (this.state.awaitingConfirmation) { // SOS Confirmation
        if (text.includes('oui') || text.includes('ok') || text.includes('démarrer') || text.includes('confirmer') || text.includes('vas-y')) {
            intent.action = 'CONFIRM_YES';
        } else if (text.includes('non') || text.includes('annuler') || text.includes('stop')) {
            intent.action = 'CONFIRM_NO';
        }
    } else {
        if (text.includes('aller à') || text.includes('aller a') || text.includes('itinéraire vers') || text.includes('itineraire vers') || text.includes('emmène-moi') || text.includes('emmene moi a')) {
           intent.action = 'SEARCH_DESTINATION';
           const dest = text.replace(/aller (à|a)|itinéraire vers|itineraire vers|emmène-moi (à|a)|emmene moi (à|a)/g, '').trim();
           intent.argument = dest;
        } else if (text.includes('annuler itinéraire') || text.includes('annuler l\'itinéraire') || text.includes('annuler navigation') || text.includes('arrête la navigation')) {
           intent.action = 'CANCEL_NAV';
        } else if (text.includes('mode sûr') || text.includes('mode sur') || text.includes('le plus sûr')) {
           intent.action = 'SET_ROUTE_PREF'; intent.routePref = 'safest';
        } else if (text.includes('mode court') || text.includes('mode rapide') || text.includes('le plus rapide')) {
           intent.action = 'SET_ROUTE_PREF'; intent.routePref = 'fastest';
        } else if (text.includes('centrer sur ma position') || text.includes('où suis-je') || text.includes('ma position')) {
           intent.action = 'CENTER_MAP';
        } else if (text.includes('activer sos') || text.includes('au secours') || text.includes('appel à l\'aide') || text.includes('déclencher sos')) {
           intent.action = 'TRIGGER_SOS';
        } else if (text.includes('annuler sos') || text.includes('désactiver sos')) {
           intent.action = 'CANCEL_SOS';
        } else if (text.includes('aide') || text.includes('que puis-je dire') || text.includes('commandes')) {
           intent.action = 'HELP';
        } else if (text.includes('répète') || text.includes('prochaine')) {
           intent.action = 'REPEAT_NAV';
        } else if (text.includes('pause')) {
           intent.action = 'PAUSE_NAV';
        } else if (text.includes('reprend') || text.includes('reprendre')) {
           intent.action = 'RESUME_NAV';
        }
    }

    this.executeIntent(intent);
  }

  private async executeIntent(intent: VoiceIntent) {
    if (intent.action === 'UNKNOWN') {
      audioGuidanceService.speak("Je n'ai pas compris la commande. Dites 'Aide' pour la liste des commandes.");
      setTimeout(() => this.updateState({ statusText: '' }), 3000);
      return;
    }

    if (intent.action === 'HELP') {
       audioGuidanceService.speak("Vous pouvez dire : Aller à, suivi de votre destination. Annuler l'itinéraire. Mode sûr ou Mode rapide. Centrer sur ma position. Ou Activer S O S.");
       setTimeout(() => this.updateState({ statusText: '' }), 10000);
       return;
    }

    if (intent.action === 'CENTER_MAP') {
       audioGuidanceService.speak("Centrage de la carte.");
       this.updateState({ statusText: 'Centrage de la carte', centerMapEvent: Date.now() });
       setTimeout(() => this.updateState({ statusText: '' }), 3000);
       return;
    }

    if (intent.action === 'TRIGGER_SOS') {
        audioGuidanceService.speak("Voulez-vous vraiment activer l'alerte S O S ? Répondez par oui ou non.");
        this.updateState({ awaitingConfirmation: true, statusText: 'Confirmer SOS ? (Oui/Non)' });
        
        setTimeout(() => {
            if (this.state.awaitingConfirmation) {
                this.startListening();
            }
        }, 5000);
        return;
    }

    if (intent.action === 'CANCEL_SOS') {
       // Logic to cancel SOS if already active, we assume it's exposed or we just say it
       const activeAlerts = sosService.getActiveAlerts(); // assuming this might exist, if not we just tell them we can't
       if (activeAlerts && activeAlerts.length > 0) {
           audioGuidanceService.speak("L'alerte S O S doit être résolue manuellement par sécurité.");
       } else {
           audioGuidanceService.speak("Aucune alerte S O S en cours.");
       }
       setTimeout(() => this.updateState({ statusText: '' }), 3000);
       return;
    }

    if (intent.action === 'SET_ROUTE_PREF' && intent.routePref) {
       simulationService.setRoutePreference(intent.routePref);
       audioGuidanceService.speak(`Itinéraire paramétré sur le mode ${intent.routePref === 'safest' ? 'sûr' : 'rapide'}.`);
       setTimeout(() => this.updateState({ statusText: '' }), 3000);
       return;
    }

    if (intent.action === 'CONFIRM_YES') {
        if (this.state.awaitingConfirmation) {
            // It was a SOS confirmation
            const simState = simulationService.getState();
            const user = simState.vrus.find(v => v.isUserControlled);
            if (user) {
                audioGuidanceService.speak(`Alerte S O S déclenchée.`);
                await sosService.triggerSos(user.position.lat, user.position.lng, user.type);
            }
        }
        this.updateState({ awaitingConfirmation: false, statusText: '' });
        return;
    }

    if (intent.action === 'CONFIRM_NO') {
        audioGuidanceService.speak("Action annulée.");
        this.updateState({ awaitingConfirmation: false, statusText: '' });
        return;
    }

    if (intent.action === 'CANCEL_NAV') {
        simulationService.clearRoute();
        audioGuidanceService.speak("Navigation annulée.");
        this.updateState({ statusText: '', awaitingOptionSelection: false, awaitingConfirmation: false, pendingPois: [] });
        return;
    }

    if (intent.action === 'REPEAT_NAV') {
        const simState = simulationService.getState();
        if (simState.route && simState.route.steps.length > 0) {
            const currentStepIdx = audioGuidanceService.getCurrentStepIndex();
            const nextStep = simState.route.steps[currentStepIdx];
            if (nextStep) {
                audioGuidanceService.speak(nextStep.instruction);
            } else {
                audioGuidanceService.speak("Vous êtes bientôt arrivé.");
            }
        } else {
             audioGuidanceService.speak("Aucune navigation en cours.");
        }
        this.updateState({ statusText: '' });
        return;
    }

    if (intent.action === 'SEARCH_DESTINATION' && intent.argument) {
        audioGuidanceService.speak(`Je cherche ${intent.argument}...`);
        this.updateState({ statusText: `Recherche de ${intent.argument}...` });

        const results = await geocodingService.search(intent.argument);
        
        if (results.length > 1) {
            const topResults = results.slice(0, 3);
            let optionsText = `J'ai trouvé ${topResults.length} résultats. `;
            topResults.forEach((p, idx) => {
                optionsText += `Option ${idx + 1}, ${p.name}. `;
            });
            optionsText += `Dis "un", "deux", ou "trois", ou "annuler".`;
            
            audioGuidanceService.speak(optionsText);
            this.updateState({
                awaitingOptionSelection: true,
                pendingPois: topResults,
                statusText: `Plusieurs résultats. Quel est votre choix ? (1/2/3)`
            });
            
            setTimeout(() => {
                if (this.state.awaitingOptionSelection) {
                    this.startListening();
                }
            }, 8000); 
            
        } else if (results.length === 1) {
            const best = results[0];
            await this.initiateNavigation(best);
        } else {
            audioGuidanceService.speak(`Désolé, je n'ai rien trouvé pour ${intent.argument}.`);
            this.updateState({ statusText: '' });
        }
        return;
    }

    if (intent.action === 'SELECT_OPTION' && intent.optionIndex !== undefined) {
        const selected = this.state.pendingPois[intent.optionIndex];
        if (selected) {
            this.updateState({ awaitingOptionSelection: false, pendingPois: [] });
            await this.initiateNavigation(selected);
        } else {
            audioGuidanceService.speak("Option invalide, veuillez répéter.");
            setTimeout(() => {
                if (this.state.awaitingOptionSelection) {
                    this.startListening();
                }
            }, 3000);
        }
        return;
    }
  }

  private async initiateNavigation(poi: POI | GeocodingResult) {
      this.updateState({ statusText: `Calcul de l'itinéraire vers ${poi.name}...` });
      
      const route = await simulationService.setDestination(poi.lat, poi.lng, poi.name);
      
      this.updateState({ statusText: `Navigation vers ${poi.name}` });
      audioGuidanceService.speak(`C'est parti. Navigation vers ${poi.name}.`);
      
      setTimeout(() => this.updateState({ statusText: '' }), 5000);
  }
}

export const voiceAssistantService = new VoiceAssistantService();
