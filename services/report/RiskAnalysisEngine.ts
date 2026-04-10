import { SimulationState, VRU } from '../../types';
import { RiskAnalysis } from './types';

export class RiskAnalysisEngine {
  static analyze(state: SimulationState, history: any[]): RiskAnalysis {
    const userAgent = state.vrus.find(v => v.isUserControlled);
    if (!userAgent) {
      return this.getEmptyAnalysis();
    }

    const avgRisk = history.reduce((acc, curr) => acc + curr.risk, 0) / (history.length || 1);
    const maxRisk = Math.max(...history.map(h => h.risk), 0);
    const totalAlerts = state.metrics.collisionWarnings;

    // Safety Index (0-100) - Inverse of Risk, weighted by alerts
    // 100 is perfect safety. 0 is catastrophic.
    const safetyIndex = Math.max(0, 100 - (avgRisk * 0.7 + (totalAlerts * 5)));

    // Risk Confidence Calculation
    // Depends on: GPS Integrity (simulated), Sensor Uncertainty, Data Completeness
    const gpsIntegrity = 0.98; // Simulated high integrity
    const sensorUncertainty = state.metrics.avgError; // Lower is better
    const dataCompleteness = 1.0; // Full simulation data available

    // Confidence drops as error increases. 
    // If error > 1m, confidence drops significantly.
    const errorFactor = Math.max(0, 1 - (sensorUncertainty / 2)); 
    const riskConfidence = (gpsIntegrity * 0.4 + errorFactor * 0.4 + dataCompleteness * 0.2) * 100;

    // Dominant Factor Analysis
    const factors = userAgent.riskFactors || {
      dynamic: { agentDistance: 0, relativeSpeed: 0, localDensity: 0 },
      topology: { totalScore: 0 },
      compatibility: { infrastructureMismatch: 0 },
      sensor: { gpsAccuracy: 0, reliabilityScore: 0 }
    };

    const config = state.riskScoreConfig || { w1_distance: 30, w2_relativeSpeed: 20, w3_density: 15, w4_topology: 15, w5_infrastructureMismatch: 10, w6_sensorUncertainty: 10 };

    const contributions = [
      { name: 'distance', value: factors.dynamic.agentDistance, weight: config.w1_distance },
      { name: 'relativeSpeed', value: factors.dynamic.relativeSpeed, weight: config.w2_relativeSpeed },
      { name: 'density', value: factors.dynamic.localDensity, weight: config.w3_density },
      { name: 'topology', value: factors.topology.totalScore, weight: config.w4_topology },
      { name: 'infrastructure', value: factors.compatibility.infrastructureMismatch, weight: config.w5_infrastructureMismatch },
      { name: 'sensor', value: (factors.sensor.gpsAccuracy + factors.sensor.reliabilityScore)/2, weight: config.w6_sensorUncertainty },
    ];

    const dominant = contributions.reduce((prev, current) => {
      return (prev.value * prev.weight) > (current.value * current.weight) ? prev : current;
    });

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (avgRisk > 80) riskLevel = 'CRITICAL';
    else if (avgRisk > 50) riskLevel = 'HIGH';
    else if (avgRisk > 20) riskLevel = 'MEDIUM';

    return {
      safetyIndex,
      riskConfidence,
      dominantFactor: {
        name: dominant.name,
        value: dominant.value,
        contribution: (dominant.value * dominant.weight)
      },
      riskLevel,
      metrics: {
        avgRisk,
        maxRisk,
        totalAlerts
      }
    };
  }

  private static getEmptyAnalysis(): RiskAnalysis {
    return {
      safetyIndex: 100,
      riskConfidence: 0,
      dominantFactor: { name: 'None', value: 0, contribution: 0 },
      riskLevel: 'LOW',
      metrics: { avgRisk: 0, maxRisk: 0, totalAlerts: 0 }
    };
  }
}
