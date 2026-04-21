import { RouteStep } from '../types';

export interface AudioGuidanceState {
  enabled: boolean;
  language: 'FR' | 'EN';
  currentStepIndex: number;
  rate: number;
  voiceURI: string | null;
}

export interface AudioGuidanceAnnouncement {
  text: string;
  timestamp: number;
}

export class AudioGuidanceService {
  private state: AudioGuidanceState = {
    enabled: false,
    language: 'FR',
    currentStepIndex: 0,
    rate: 1.0,
    voiceURI: null
  };

  private synthesis: SpeechSynthesis | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private voice: SpeechSynthesisVoice | null = null;
  private lastAnnouncedStepIndex: number = -1;
  private upcomingAnnouncedIndex: number = -1;
  
  private listeners: ((announcement: AudioGuidanceAnnouncement) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = () => this.loadVoices();
      }
      this.loadVoices();
    }
  }

  public subscribe(listener: (announcement: AudioGuidanceAnnouncement) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(text: string) {
    const announcement = { text, timestamp: Date.now() };
    this.listeners.forEach(l => l(announcement));
  }

  private loadVoices() {
    if (!this.synthesis) return;
    this.availableVoices = this.synthesis.getVoices();
    if (!this.availableVoices.length) return;

    this.selectBestVoice();
  }

  private selectBestVoice() {
    if (!this.availableVoices.length) return;

    const langPattern = this.state.language === 'FR' ? /^fr/i : /^en/i;
    
    if (this.state.voiceURI) {
      const selected = this.availableVoices.find(v => v.voiceURI === this.state.voiceURI);
      if (selected) {
        this.voice = selected;
        return;
      }
    }

    const preferredVoice = this.availableVoices.find(v => langPattern.test(v.lang));
    this.voice = preferredVoice || this.availableVoices[0];
    this.state.voiceURI = this.voice.voiceURI;
  }

  public getAvailableVoices() {
    const langPattern = this.state.language === 'FR' ? /^fr/i : /^en/i;
    return this.availableVoices.filter(v => langPattern.test(v.lang));
  }

  public setVoice(voiceURI: string) {
    this.state.voiceURI = voiceURI;
    this.selectBestVoice();
    if (this.state.enabled) {
      this.speak(this.state.language === 'FR' ? "Voix modifiée" : "Voice changed");
    }
  }

  public setRate(rate: number) {
    this.state.rate = rate;
    if (this.state.enabled) {
      this.speak(this.state.language === 'FR' ? "Vitesse modifiée" : "Speed changed");
    }
  }

  public getRate() {
    return this.state.rate;
  }

  public setEnabled(enabled: boolean) {
    this.state.enabled = enabled;
    if (!enabled) {
      if (this.synthesis) this.synthesis.cancel();
      this.lastAnnouncedStepIndex = -1;
      this.upcomingAnnouncedIndex = -1;
      this.state.currentStepIndex = 0;
    } else {
      this.speak(this.state.language === 'FR' ? "Guidage audio activé" : "Audio guidance enabled");
    }
  }

  public isEnabled(): boolean {
    return this.state.enabled;
  }

  public setLanguage(lang: 'FR' | 'EN') {
    this.state.language = lang;
    this.state.voiceURI = null; // reset to best voice for this lang
    this.selectBestVoice();
    if (this.state.enabled) {
      this.speak(lang === 'FR' ? "Langue changée" : "Language changed");
    }
  }

  public getLanguage(): 'FR' | 'EN' {
    return this.state.language;
  }

  public getCurrentStepIndex(): number {
    return this.state.currentStepIndex;
  }

  public advanceStep() {
    this.state.currentStepIndex++;
  }

  public resetProgress() {
    this.state.currentStepIndex = 0;
    this.lastAnnouncedStepIndex = -1;
    this.upcomingAnnouncedIndex = -1;
    if (this.synthesis) this.synthesis.cancel();
  }

  public speak(text: string) {
    this.notifyListeners(text); // Notify accessibility screen reader region
    
    if (!this.state.enabled || !this.synthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.lang = this.state.language === 'FR' ? 'fr-FR' : 'en-US';
    utterance.rate = this.state.rate;
    utterance.pitch = 1.0;

    this.synthesis.speak(utterance);
  }

  // Audio tone generation for V2/Fallback
  private playTone() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      // AudioContext not supported or unmuted yet
    }
  }

  public updatePosition(distanceToNextStep: number, nextStep?: RouteStep, stepIndex?: number) {
    if (!this.state.enabled || !nextStep || stepIndex === undefined) return;

    if (stepIndex > this.state.currentStepIndex) {
      this.state.currentStepIndex = stepIndex;
    }

    if (stepIndex <= this.lastAnnouncedStepIndex) {
      return; // Already triggered the final announcement
    }

    const m = this.state.language === 'FR' ? 'mètres' : 'meters';
    const inText = this.state.language === 'FR' ? 'Dans' : 'In';

    // 1. Advance Warning (e.g. at 200m)
    if (distanceToNextStep > 100 && distanceToNextStep <= 250 && this.upcomingAnnouncedIndex < stepIndex) {
      this.upcomingAnnouncedIndex = stepIndex;
      const roundedDist = Math.round(distanceToNextStep / 50) * 50; // round to nearest 50
      this.speak(`${inText} ${roundedDist} ${m}, ${nextStep.instruction}`);
      return;
    }

    // 2. Immediate Warning (e.g. at 30m)
    const ANNOUNCE_THRESHOLD_METERS = 30;
    if (distanceToNextStep <= ANNOUNCE_THRESHOLD_METERS) {
      this.playTone();
      this.speak(`${inText} ${Math.round(distanceToNextStep)} ${m}, ${nextStep.instruction}`);
      this.lastAnnouncedStepIndex = stepIndex;
    }
  }
}

export const audioGuidanceService = new AudioGuidanceService();
