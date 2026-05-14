import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';
import { audioGuidanceService } from './AudioGuidanceService';
import { overpassService, POI } from './OverpassService';
import { routingService } from './RoutingService';
import { simulationService } from './SimulationService';
import { Coordinates } from '../types';

export interface VoiceAssistantState {
  isListening: boolean;
  statusText: string;
  awaitingConfirmation: boolean;
  awaitingOptionSelection: boolean;
  pendingPois: POI[];
  currentPoiIndex: number;
}

export type VoiceAssistantListener = (state: VoiceAssistantState) => void;

interface VoiceIntent {
  action: 'SEARCH_POI' | 'CANCEL_NAV' | 'PAUSE_NAV' | 'RESUME_NAV' | 'REPEAT_NAV' | 'UNKNOWN' | 'CONFIRM_YES' | 'CONFIRM_NO' | 'SELECT_OPTION';
  poiType?: string;
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

  private initWebSpeech() {
    if (!this.isNative && typeof window !== 'undefined') {
      const SpeechRecognitionConfig = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionConfig) {
        this.webRecognition = new SpeechRecognitionConfig();
        this.webRecognition.continuous = false;
        this.webRecognition.interimResults = false;
        this.webRecognition.lang = 'fr-FR';

        this.webRecognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          this.processCommand(transcript);
          this.stopListening();
        };

        this.webRecognition.onerror = (event: any) => {
          console.error("Web Speech error", event.error);
          this.updateState({ statusText: `Erreur: ${event.error}`, isListening: false });
          setTimeout(() => this.updateState({ statusText: '' }), 3000);
          this.stopListening();
        };
        
        this.webRecognition.onend = () => {
           this.stopListening();
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

        // On Capacitor mobile, start() returns a promise resolving with the final matches
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
          // might be already started
          this.updateState({ isListening: false });
        }
      } else {
        this.updateState({ isListening: false, statusText: "Non supporté sur ce navigateur" });
        setTimeout(() => this.updateState({ statusText: '' }), 3000);
      }
    }
  }

  // Capacitor requires explicit stop, but we will also process results in a listener that we should setup once.
  // Actually, @capacitor-community/speech-recognition has an issue where start() resolves immediately or wait for results?
  // Let's hook the listener.
  
  public async setupNativeListeners() {
      if (!this.isNative) return;
      // We will just process when it stops or matches
  }

  public async stopListening() {
     if (!this.state.isListening) return;
     this.updateState({ isListening: false });
     if (this.isNative) {
         try {
             // Capacitor plugin doesn't have a stop() in all versions, sometimes it auto-stops.
             // We'll rely on the native UI or auto-timeout.
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
    
    // Simplistic Intent Parsing (RegEx / rules)
    const text = transcript.toLowerCase();
    let intent: VoiceIntent = { action: 'UNKNOWN' };

    if (this.state.awaitingOptionSelection) {
        if (text.includes('annuler') || text.includes('stop') || text.includes('non')) {
            intent.action = 'CANCEL_NAV';
        } else if (text.includes('1') || text.includes('un') || text.includes('premier') || text.includes('première')) {
            intent.action = 'SELECT_OPTION';
            intent.optionIndex = 0;
        } else if (text.includes('2') || text.includes('deux') || text.includes('deuxième')) {
            intent.action = 'SELECT_OPTION';
            intent.optionIndex = 1;
        } else if (text.includes('3') || text.includes('trois') || text.includes('troisième')) {
            intent.action = 'SELECT_OPTION';
            intent.optionIndex = 2;
        }
    } else if (this.state.awaitingConfirmation) {
        if (text.includes('oui') || text.includes('ok') || text.includes('démarrer') || text.includes('vas-y')) {
            intent.action = 'CONFIRM_YES';
        } else if (text.includes('non') || text.includes('annuler') || text.includes('autre')) {
            intent.action = 'CONFIRM_NO';
        }
    } else {
        if (text.includes('annule') || text.includes('arrête') || text.includes('stop')) {
            intent.action = 'CANCEL_NAV';
        } else if (text.includes('pause')) {
            intent.action = 'PAUSE_NAV';
        } else if (text.includes('reprend') || text.includes('reprendre')) {
            intent.action = 'RESUME_NAV';
        } else if (text.includes('répète') || text.includes('prochaine')) {
            intent.action = 'REPEAT_NAV';
        } else if (text.includes('cherche') || text.includes('trouve') || text.includes('aller') || text.includes('amène')) {
            intent.action = 'SEARCH_POI';
            if (text.includes('pharmacie')) intent.poiType = 'pharmacy';
            else if (text.includes('hôpital') || text.includes('hopital')) intent.poiType = 'hospital';
            else if (text.includes('parking')) intent.poiType = 'parking';
            else if (text.includes('banque')) intent.poiType = 'bank';
            else if (text.includes('supermarché') || text.includes('course')) intent.poiType = 'supermarket';
            else if (text.includes('restaurant') || text.includes('manger')) intent.poiType = 'restaurant';
            else if (text.includes('essence') || text.includes('station')) intent.poiType = 'fuel';
            
            if (!intent.poiType) intent.action = 'UNKNOWN'; // Could not extract POI
        } else if (text.includes('pharmacie')) { intent.action = 'SEARCH_POI'; intent.poiType = 'pharmacy'; }
        else if (text.includes('hôpital') || text.includes('hopital')) { intent.action = 'SEARCH_POI'; intent.poiType = 'hospital'; }
        else if (text.includes('parking')) { intent.action = 'SEARCH_POI'; intent.poiType = 'parking'; }
        else if (text.includes('banque')) { intent.action = 'SEARCH_POI'; intent.poiType = 'bank'; }
    }

    this.executeIntent(intent);
  }

  private async executeIntent(intent: VoiceIntent) {
    if (intent.action === 'UNKNOWN') {
      audioGuidanceService.speak("Je n'ai pas compris. Pouvez-vous répéter ?");
      this.updateState({ statusText: '' });
      return;
    }

    if (intent.action === 'CONFIRM_YES') {
        const poi = this.state.pendingPois[this.state.currentPoiIndex];
        if (poi) {
            audioGuidanceService.speak(`C'est parti. Navigation vers ${poi.name}.`);
            // Trigger routing!
            simulationService.setDestination(poi.lat, poi.lng, poi.name);
        }
        this.updateState({ awaitingConfirmation: false, awaitingOptionSelection: false, pendingPois: [], statusText: '' });
        return;
    }

    if (intent.action === 'CONFIRM_NO') {
        audioGuidanceService.speak("Navigation annulée.");
        this.updateState({ awaitingConfirmation: false, awaitingOptionSelection: false, pendingPois: [], statusText: '' });
        return;
    }

    if (intent.action === 'CANCEL_NAV') {
        simulationService.clearRoute();
        audioGuidanceService.speak("Navigation annulée.");
        this.updateState({ statusText: '', awaitingOptionSelection: false, awaitingConfirmation: false, pendingPois: [] });
        return;
    }

    if (intent.action === 'REPEAT_NAV') {
        // Find next step and repeat
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

    if (intent.action === 'SEARCH_POI' && intent.poiType) {
        audioGuidanceService.speak(`Je cherche un(e) ${intent.poiType} à proximité...`);
        this.updateState({ statusText: `Recherche de ${intent.poiType}...` });
        
        const simState = simulationService.getState();
        const userVru = simState.vrus.find(v => v.isUserControlled);
        
        if (!userVru) {
            audioGuidanceService.speak("Erreur: je n'ai pas pu déterminer votre position.");
            this.updateState({ statusText: '' });
            return;
        }

        const pois = await overpassService.findNearbyPOI(userVru.position, intent.poiType);
        
        if (pois.length > 1) {
            const topPois = pois.slice(0, 3);
            let optionsText = `J'ai trouvé ${topPois.length} options. `;
            topPois.forEach((p, idx) => {
                const dist = p.distance ? `${Math.round(p.distance)} mètres` : 'proximité';
                optionsText += `Option ${idx + 1}, ${p.name} à ${dist}. `;
            });
            optionsText += `Dis "option 1", "option 2", ou "annuler".`;
            
            audioGuidanceService.speak(optionsText);
            this.updateState({
                awaitingOptionSelection: true,
                pendingPois: topPois,
                statusText: `Plusieurs résultats trouvés. En attente de choix...`
            });
            
            setTimeout(() => {
                if (this.state.awaitingOptionSelection) {
                    this.startListening();
                }
            }, 6000); // Wait for the TTS to finish explaining options before listening
            
        } else if (pois.length === 1) {
            const best = pois[0];
            await this.initiateNavigation(best);
        } else {
            audioGuidanceService.speak(`Désolé, je n'ai rien trouvé à proximité.`);
            this.updateState({ statusText: '' });
        }
        return;
    }

    if (intent.action === 'SELECT_OPTION' && intent.optionIndex !== undefined) {
        const selectedPoi = this.state.pendingPois[intent.optionIndex];
        if (selectedPoi) {
            this.updateState({ awaitingOptionSelection: false, pendingPois: [] });
            await this.initiateNavigation(selectedPoi);
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

  private async initiateNavigation(poi: POI) {
      this.updateState({ statusText: `Calcul de l'itinéraire vers ${poi.name}...` });
      
      const route = await simulationService.setDestination(poi.lat, poi.lng, poi.name);
      
      if (route) {
          this.updateState({ statusText: `Navigation vers ${poi.name}` });
      } else {
          audioGuidanceService.speak("Je n'ai pas pu calculer d'itinéraire. Réessaie ou choisis une autre destination.");
          this.updateState({ statusText: '' });
      }
      
      setTimeout(() => this.updateState({ statusText: '' }), 5000);
  }
}

export const voiceAssistantService = new VoiceAssistantService();
