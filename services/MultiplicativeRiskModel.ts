export enum RiskLevel {
  SAFE = 'SAFE',
  WARNING = 'WARNING',
  DANGER = 'DANGER',
  CRITICAL = 'CRITICAL'
}

export interface RiskFactor {
  name: string;
  value: number;      // Raw sensor/telemetry value
  min: number;        // Expected minimum (best case)
  max: number;        // Expected maximum (worst case)
  weight: number;     // Importance multiplier (e.g., 1.0 to 5.0)
  invert?: boolean;   // If true, lower values are riskier (e.g., distance)
}

export class MultiplicativeRiskModel {
  // Sensitivity constant for the stable transformation.
  // Higher value = reaches 100 faster.
  private static readonly K_FACTOR = 0.35;

  /**
   * 1. Normalization: Min-Max scaling to [0, 1]
   */
  private static normalize(factor: RiskFactor): number {
    if (factor.max === factor.min) return 0;
    
    let normalized = (factor.value - factor.min) / (factor.max - factor.min);
    
    if (factor.invert) {
      normalized = 1 - normalized;
    }

    // Clamp strictly between 0 and 1
    return Math.max(0, Math.min(1, normalized));
  }

  /**
   * 2. Multiplicative Aggregation & 3. Stable Transformation
   */
  public static calculateRisk(factors: RiskFactor[]): { score: number, level: RiskLevel, details: Record<string, number> } {
    if (factors.length === 0) {
      return { score: 0, level: RiskLevel.SAFE, details: {} };
    }

    let riskProduct = 1;
    const details: Record<string, number> = {};

    for (const factor of factors) {
      const normValue = this.normalize(factor);
      details[factor.name] = normValue; // Store normalized value for XAI/Debugging
      
      // Compounding: (1 + weight * normalized_value)
      // If normValue is 0, multiplier is 1.
      riskProduct *= (1 + factor.weight * normValue);
    }

    // Shift product so baseline (no risk) starts at 0
    const shiftedProduct = riskProduct - 1;

    // Stable Transformation: Exponential decay mapping to [0, 100]
    // Formula: 100 * (1 - e^(-k * x))
    const rawScore = 100 * (1 - Math.exp(-this.K_FACTOR * shiftedProduct));
    const finalScore = Math.round(rawScore * 100) / 100; // Round to 2 decimals

    return {
      score: finalScore,
      level: this.classifyRisk(finalScore),
      details
    };
  }

  /**
   * 4. Adapted Thresholds Classification
   */
  public static classifyRisk(score: number): RiskLevel {
    if (score < 30) return RiskLevel.SAFE;
    if (score < 65) return RiskLevel.WARNING;
    if (score < 85) return RiskLevel.DANGER;
    return RiskLevel.CRITICAL;
  }
}
