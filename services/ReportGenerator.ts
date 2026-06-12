import { GoogleGenAI, Type } from "@google/genai";
import { generatePDFReport } from './ReportService';
import { SimulationState, User, OptimizationContext } from '../types';
import { ReportLanguage } from './ReportLocalization';

interface GeneratorOptions {
  user: User | null;
  state: SimulationState;
  history: any[];
  context: OptimizationContext;
  recommendation: string;
  rmseAnalysis: string;
  language: ReportLanguage;
  apiKey?: string;
  onProgress?: (percent: number) => void;
}

class ReportGenerator {
  private lastSummary: string | null = null;
  private lastSummaryTime: number = 0;
  private lastLanguage: ReportLanguage = 'EN';

  public async generate(options: GeneratorOptions): Promise<void> {
    const { onProgress } = options;
    const reportProgress = (percent: number) => {
      if (onProgress) onProgress(percent);
    };

    reportProgress(0);
    let aiSummary = this.getFallbackSummary(options.language);
    let aiRiskAnalysis = "";
    let strategicRecommendation = undefined;

    // Cache strategy: Reuse summary if within 60 seconds and language hasn't changed
    const now = Date.now();
    const isCacheValid = this.lastSummary && 
                         (now - this.lastSummaryTime < 60000) && 
                         (this.lastLanguage === options.language);

    if (isCacheValid) {
      console.log("ReportGenerator: Using cached AI summary to save quota.");
      aiSummary = this.lastSummary!;
      reportProgress(10);
    } else if (options.apiKey) {
      try {
        reportProgress(5);
        // Parallelize AI calls
        const [summary, analysis, strategy] = await Promise.all([
            this.fetchAISummary(options),
            this.fetchRiskBreakdownAnalysis(options),
            this.fetchStrategicRecommendation(options)
        ]);
        
        if (summary) {
          aiSummary = summary;
          // Update Cache
          this.lastSummary = summary;
          this.lastSummaryTime = now;
          this.lastLanguage = options.language;
        }
        if (analysis) {
            aiRiskAnalysis = analysis;
        }
        if (strategy) {
            strategicRecommendation = strategy;
        }
        reportProgress(20);
      } catch (error) {
        console.warn("ReportGenerator: AI Summary failed (Quota/Network), using fallback.", error);
        // Fallback is already set
      }
    }

    // Generate PDF using the renderer
    // We await the async generation which now includes yields to keep UI responsive
    await generatePDFReport({
        ...options,
        aiSummary,
        aiRiskAnalysis,
        strategicRecommendation,
        onProgress: (p) => reportProgress(20 + (p * 0.80)) // Map 0-100 to 20-100
    });
  }

  private getFallbackSummary(lang: ReportLanguage): string {
    return lang === 'FR' 
      ? "Le résumé IA n'est pas disponible actuellement (Quota dépassé ou hors ligne). Veuillez vous référer aux métriques détaillées ci-dessous pour l'analyse de sécurité."
      : "AI Summary unavailable (Quota exceeded or offline). Please refer to the detailed metrics below for safety analysis.";
  }

  private async fetchStrategicRecommendation(options: GeneratorOptions): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: options.apiKey! });
    const userAgent = options.state.vrus.find(v => v.isUserControlled);
    const activeSensors = userAgent?.sensors.filter(s => s.active).length || 0;
    const rmse = options.state.metrics.avgError;
    const risk = options.state.metrics.collisionWarnings > 0 ? 'HIGH' : 'LOW';
    
    const prompt = `
      Role: Strategic Safety Consultant for VRU-Guard.
      Language: ${options.language === 'FR' ? 'FRENCH' : 'ENGLISH'}
      
      Task: Provide a strategic recommendation to optimize sensor configuration.
      
      Current State:
      - Active Sources (N): ${activeSensors}
      - Current RMSE: ${rmse.toFixed(4)}m
      - Risk Level: ${risk}
      - Context: ${options.context.environment}
      
      Requirements:
      1. Recommend increasing or decreasing sensor sources based on N and RMSE.
      2. Provide a detailed technical explanation (mention Dilution of Precision, Quantum/Classical limits, or Redundancy).
      3. Propose a specific solution (e.g., "Add LiDAR", "Enable Galileo").
      4. Predict the expected new RMSE and Risk Level.
      
      Output JSON format:
      {
        "action": "Increase/Decrease/Maintain",
        "technicalReasoning": "...",
        "solution": "...",
        "prediction": {
          "expectedRMSE": "0.5m",
          "expectedRisk": "LOW"
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING },
                technicalReasoning: { type: Type.STRING },
                solution: { type: Type.STRING },
                prediction: {
                    type: Type.OBJECT,
                    properties: {
                        expectedRMSE: { type: Type.STRING },
                        expectedRisk: { type: Type.STRING }
                    }
                }
            }
        }
      }
    });

    try {
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Failed to parse strategic recommendation", e);
        return null;
    }
  }

  private async fetchRiskBreakdownAnalysis(options: GeneratorOptions): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: options.apiKey! });
    const userAgent = options.state.vrus.find(v => v.isUserControlled);
    const factors = userAgent?.riskFactors;
    
    if (!factors) return "";

    const prompt = `
      Role: Senior Risk Analyst for VRU-Guard.
      Language: ${options.language === 'FR' ? 'FRENCH' : 'ENGLISH'}
      
      Task: Analyze the following Multi-Parameter Risk Breakdown and explain the contribution of each factor to the total risk.
      
      Risk Factors (Normalized 0-1):
      - Proximity: ${factors.dynamic.agentDistance.toFixed(2)}
      - Relative Speed: ${factors.dynamic.relativeSpeed.toFixed(2)}
      - Crowd Density: ${factors.dynamic.localDensity.toFixed(2)}
      - Topology Complexity: ${factors.topology.totalScore.toFixed(2)}
      - Infrastructure Mismatch: ${factors.compatibility.infrastructureMismatch.toFixed(2)}
      - Sensor Uncertainty: ${factors.sensor.gpsAccuracy.toFixed(2)}
      
      Output: A concise, technical paragraph (max 4 sentences) explaining which factors are driving the risk and why. Use professional engineering terminology.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "";
  }

  private async fetchAISummary(options: GeneratorOptions): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: options.apiKey! });
    const userAgent = options.state.vrus.find(v => v.isUserControlled);
    
    const prompt = `
      Role: Senior Safety Analyst for VRU-Guard.
      
      Task: Generate a professional Executive Summary (max 3 sentences) for a safety report in ${options.language === 'FR' ? 'FRENCH' : 'ENGLISH'}.
      
      Context:
      - User: ${options.user?.name} (${options.user?.organization})
      - VRU Type: ${userAgent?.type}
      - Environment: ${options.context.weather}, ${options.context.time}, ${options.context.environment}
      - Metrics: ${options.state.metrics.collisionWarnings} warnings, ${options.state.metrics.avgError.toFixed(4)}m avg error.
      - Status: ${options.state.metrics.quantumFusionActive ? 'Quantum Enhanced' : 'Standard Fusion'}
      
      Focus on the operational readiness and safety posture of the session.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "";
  }
}

export const reportGenerator = new ReportGenerator();
