import { SimulationState, User, OptimizationContext, VRU } from '../../types';

export type ReportLanguage = 'EN' | 'FR';

export interface ReportData {
  user: User | null;
  state: SimulationState;
  history: any[];
  context: OptimizationContext;
  aiSummary: string;
  aiRiskAnalysis?: string;
  strategicRecommendation?: {
    action: string;
    technicalReasoning: string;
    solution: string;
    prediction: {
      expectedRMSE: string;
      expectedRisk: string;
    };
  };
  recommendation: string; // Keep original simple one as fallback or tactical
  rmseAnalysis: string;
  language: ReportLanguage;
  onProgress?: (percent: number) => void;
}

export interface RiskAnalysis {
  safetyIndex: number; // 0-100
  riskConfidence: number; // 0-100
  dominantFactor: {
    name: string;
    value: number;
    contribution: number;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metrics: {
    avgRisk: number;
    maxRisk: number;
    totalAlerts: number;
  };
}

export interface ReportTheme {
  colors: {
    primary: [number, number, number];
    secondary: [number, number, number];
    accent: [number, number, number];
    background: [number, number, number];
    text: {
      main: [number, number, number];
      light: [number, number, number];
      inverse: [number, number, number];
    };
    risk: {
      low: [number, number, number];
      medium: [number, number, number];
      high: [number, number, number];
      critical: [number, number, number];
    };
  };
  fonts: {
    main: string;
    heading: string;
    code: string;
  };
}
