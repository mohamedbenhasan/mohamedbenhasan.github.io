import { GoogleGenAI, Type } from "@google/genai";
import { RiskScoreConfig, OptimizationContext, SimulationState } from '../types';

export interface OptimizationResult {
  config: RiskScoreConfig;
  reasoning: string;
  confidence: number;
}

export class WeightOptimizer {
  
  public async optimizeWeights(
    apiKey: string,
    currentConfig: RiskScoreConfig,
    state: SimulationState,
    history: any[],
    context: OptimizationContext
  ): Promise<OptimizationResult | null> {
    
    const ai = new GoogleGenAI({ apiKey });
    const user = state.vrus.find(v => v.isUserControlled);
    
    // Analyze history for trends
    const recentHistory = history.slice(-20); // Last 20 points (approx 2-5 seconds depending on sampling)
    const avgRisk = recentHistory.reduce((acc, curr) => acc + (curr.risk || 0), 0) / (recentHistory.length || 1);
    const maxRisk = Math.max(...recentHistory.map(h => h.risk || 0));
    const avgError = recentHistory.reduce((acc, curr) => acc + (curr.error || 0), 0) / (recentHistory.length || 1);
    
    const prompt = `
      Role: AI Risk Model Architect for VRU-Guard.
      Task: Optimize the weights (w1-w6) of the Multi-Parameter Risk Formula based on historical performance and current conditions.
      
      Current Context:
      - Environment: ${context.environment}, ${context.weather}, ${context.time}
      
      Historical Performance (Last 20 ticks):
      - Avg Risk Level: ${avgRisk.toFixed(2)} (Target: < 1.0)
      - Peak Risk: ${maxRisk}
      - Avg RMSE: ${avgError.toFixed(2)}m
      
      Current Weights:
        w1 (Distance): ${currentConfig.w1_distance}
        w2 (RelSpeed): ${currentConfig.w2_relativeSpeed}
        w3 (Density): ${currentConfig.w3_density}
        w4 (Topology): ${currentConfig.w4_topology}
        w5 (Infra): ${currentConfig.w5_infrastructureMismatch}
        w6 (Sensor): ${currentConfig.w6_sensorUncertainty}
        
      Objective:
      - If Peak Risk is high, increase sensitivity to the dominant factor (e.g., if Speed was high, increase w2).
      - If Avg Risk is low but environment is dangerous (e.g., Rain), preemptively increase w6 (Sensor) and w1 (Distance).
      - If High Density/Urban: Increase w3 (Density) and w5 (Infra).
      - Maintain total sum roughly around 100 (soft constraint).
      
      Output JSON:
      {
        "weights": {
          "w1_distance": number,
          "w2_relativeSpeed": number,
          "w3_density": number,
          "w4_topology": number,
          "w5_infrastructureMismatch": number,
          "w6_sensorUncertainty": number,
          "densityRadius": number
        },
        "reasoning": "string explaining why weights changed based on history",
        "confidence": number (0-1)
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              weights: {
                type: Type.OBJECT,
                properties: {
                  w1_distance: { type: Type.NUMBER },
                  w2_relativeSpeed: { type: Type.NUMBER },
                  w3_density: { type: Type.NUMBER },
                  w4_topology: { type: Type.NUMBER },
                  w5_infrastructureMismatch: { type: Type.NUMBER },
                  w6_sensorUncertainty: { type: Type.NUMBER },
                  densityRadius: { type: Type.NUMBER }
                }
              },
              reasoning: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            }
          }
        }
      });

      const result = JSON.parse(response.text);
      return {
        config: result.weights,
        reasoning: result.reasoning,
        confidence: result.confidence
      };

    } catch (error) {
      console.error("Weight Optimization Failed:", error);
      return null;
    }
  }
}

export const weightOptimizer = new WeightOptimizer();
