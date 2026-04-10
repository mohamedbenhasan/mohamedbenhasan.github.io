import { VRU, VRUType, Coordinates, RiskFactors, InfrastructureType, Zone, RiskScoreConfig, RiskScore, RiskLevel, RiskCalculationModel } from '../types';
import { getDistance } from '../utils/geo';
import { topologyAnalyzer } from './TopologyAnalyzer';

// Mock Infrastructure Map (in a real app, this would be a spatial database)
// We'll define some virtual infrastructure zones based on coordinates
const INFRASTRUCTURE_ZONES = [
  { type: InfrastructureType.INTERSECTION, center: { lat: 48.8566, lng: 2.3522 }, radius: 20 },
  { type: InfrastructureType.PEDESTRIAN_ZONE, center: { lat: 48.8570, lng: 2.3530 }, radius: 50 },
  // Default is ROAD or SIDEWALK depending on some logic
];

export const DEFAULT_RISK_CONFIG: RiskScoreConfig = {
  w1_distance: 30,
  w2_relativeSpeed: 25,
  w3_density: 10,
  w4_topology: 15,
  w5_infrastructureMismatch: 10,
  w6_sensorUncertainty: 10,
  densityRadius: 50, // Default 50m
  model: RiskCalculationModel.ADDITIVE
};

export class RiskFactorEngine {

  /**
   * Main method to calculate all risk factors for a VRU
   */
  public calculateRiskFactors(vru: VRU, otherVRUs: VRU[], zones: Zone[] = [], config: RiskScoreConfig = DEFAULT_RISK_CONFIG): RiskFactors {
    const spatial = this.calculateSpatialFactors(vru, zones);
    const dynamic = this.calculateDynamicFactors(vru, otherVRUs, config.densityRadius);
    
    // New Topology Analysis
    const topology = topologyAnalyzer.analyzeTopology(vru.position, vru.heading);

    // Use topology-derived infrastructure type if available, otherwise fallback to spatial logic
    const infraType = topology.infrastructureType 
      ? (InfrastructureType[topology.infrastructureType as keyof typeof InfrastructureType] || InfrastructureType.ROAD)
      : spatial.infrastructureTypeEnum;

    const compatibility = this.calculateInfrastructureCompatibility(vru, infraType);
    const sensor = this.calculateSensorConfidence(vru);

    // Calculate total score (weighted average)
    const totalScore = (
      (spatial.score * 0.2) +
      (dynamic.score * 0.3) +
      (compatibility.score * 0.2) +
      (sensor.score * 0.1) +
      (topology.score * 0.2)
    );

    return {
      spatial: {
        infrastructureType: spatial.infrastructureTypeScore,
        intersectionProximity: spatial.intersectionProximity,
        roadCurvature: spatial.roadCurvature
      },
      topology: {
        intersectionDistance: topology.intersectionDist,
        curvatureIntensity: topology.curvature,
        isRoundabout: topology.isRoundabout ? 1 : 0,
        visibilityReduction: topology.visibility,
        totalScore: topology.score
      },
      dynamic: {
        relativeSpeed: dynamic.relativeSpeed,
        agentDistance: dynamic.agentDistance,
        localDensity: dynamic.localDensity
      },
      compatibility: {
        infrastructureMismatch: compatibility.infrastructureMismatch
      },
      sensor: {
        gpsAccuracy: sensor.gpsAccuracy,
        reliabilityScore: sensor.reliabilityScore
      },
      totalScore: Math.min(1, Math.max(0, totalScore))
    };
  }

  public calculateRiskScore(factors: RiskFactors, config: RiskScoreConfig, previousHistory: { timestamp: number; value: number }[] = []): RiskScore {
    // Extract Normalized Scores (S_i)
    const S_dist = factors.dynamic.agentDistance;
    const S_speed = factors.dynamic.relativeSpeed;
    const S_density = factors.dynamic.localDensity;
    const S_topo = factors.topology.totalScore;
    const S_infra = factors.compatibility.infrastructureMismatch;
    // Sensor Risk (0=Good, 1=Bad)
    const S_sensor = (factors.sensor.gpsAccuracy + factors.sensor.reliabilityScore) / 2;

    let finalScore = 0;
    let formula = '';
    let contributions: any = {};

    // --- MODEL SELECTION ---
    if (config.model === RiskCalculationModel.MULTIPLICATIVE) {
      // --- B. Multiplicative Model (R = D * E) ---
      
      // 1. Danger (D) - Hazard Severity
      // Factors: Relative Speed, Topology, Infrastructure Mismatch
      const w_D_speed = config.w2_relativeSpeed;
      const w_D_topo = config.w4_topology;
      const w_D_infra = config.w5_infrastructureMismatch;
      const sum_w_D = w_D_speed + w_D_topo + w_D_infra || 1;

      const D = (w_D_speed * S_speed + w_D_topo * S_topo + w_D_infra * S_infra) / sum_w_D;

      // 2. Exposure (E) - Probability of Occurrence
      // Factors: Proximity (Distance), Density, Sensor Uncertainty (Unknowns increase exposure to risk)
      const w_E_dist = config.w1_distance;
      const w_E_density = config.w3_density;
      const w_E_sensor = config.w6_sensorUncertainty;
      const sum_w_E = w_E_dist + w_E_density + w_E_sensor || 1;

      const E = (w_E_dist * S_dist + w_E_density * S_density + w_E_sensor * S_sensor) / sum_w_E;

      // Final Score: D * E (Scaled to 0-100)
      // Note: If D=1 and E=1, Score=100. If D=0.5 and E=0.5, Score=25.
      // This model suppresses moderate risks and highlights only when BOTH Danger and Exposure are high.
      finalScore = D * E * 100;

      formula = `R = (Danger: ${(D*100).toFixed(0)}%) × (Exposure: ${(E*100).toFixed(0)}%)`;

      // Calculate Contributions for XAI (Normalized relative impact)
      const rawContribs = {
        relativeSpeed: w_D_speed * S_speed,
        topology: w_D_topo * S_topo,
        infrastructure: w_D_infra * S_infra,
        distance: w_E_dist * S_dist,
        density: w_E_density * S_density,
        sensor: w_E_sensor * S_sensor
      };
      const totalRaw = Object.values(rawContribs).reduce((a, b) => a + b, 0) || 1;
      
      contributions = {
        distance: (rawContribs.distance / totalRaw) * 100,
        relativeSpeed: (rawContribs.relativeSpeed / totalRaw) * 100,
        density: (rawContribs.density / totalRaw) * 100,
        topology: (rawContribs.topology / totalRaw) * 100,
        infrastructure: (rawContribs.infrastructure / totalRaw) * 100,
        sensor: (rawContribs.sensor / totalRaw) * 100
      };

    } else {
      // --- A. Additive Model (R = Σ w_i * S_i) ---
      // Default / Simple Model
      
      const term_distance = config.w1_distance * S_dist;
      const term_relSpeed = config.w2_relativeSpeed * S_speed;
      const term_density = config.w3_density * S_density;
      const term_topology = config.w4_topology * S_topo;
      const term_infra = config.w5_infrastructureMismatch * S_infra;
      const term_sensor = config.w6_sensorUncertainty * S_sensor;

      const totalWeight = config.w1_distance + config.w2_relativeSpeed + config.w3_density + config.w4_topology + config.w5_infrastructureMismatch + config.w6_sensorUncertainty || 1;

      finalScore = ((term_distance + term_relSpeed + term_density + term_topology + term_infra + term_sensor) / totalWeight) * 100;

      formula = `R = Σ(w_i * S_i) / Σw_i`;

      contributions = {
        distance: (term_distance / (finalScore * totalWeight / 100 || 1)) * 100, // Approx % of score
        relativeSpeed: (term_relSpeed / (finalScore * totalWeight / 100 || 1)) * 100,
        density: (term_density / (finalScore * totalWeight / 100 || 1)) * 100,
        topology: (term_topology / (finalScore * totalWeight / 100 || 1)) * 100,
        infrastructure: (term_infra / (finalScore * totalWeight / 100 || 1)) * 100,
        sensor: (term_sensor / (finalScore * totalWeight / 100 || 1)) * 100
      };
      
      // Recalculate contributions simply based on weighted terms sum
      const sumTerms = term_distance + term_relSpeed + term_density + term_topology + term_infra + term_sensor || 1;
      contributions = {
        distance: (term_distance / sumTerms) * 100,
        relativeSpeed: (term_relSpeed / sumTerms) * 100,
        density: (term_density / sumTerms) * 100,
        topology: (term_topology / sumTerms) * 100,
        infrastructure: (term_infra / sumTerms) * 100,
        sensor: (term_sensor / sumTerms) * 100
      };
    }

    // --- Common Post-Processing ---

    // Sensor Confidence (Separate from Risk Score calculation itself, used for Integrity)
    // Confidence = 1 - (Average Sensor Risk Factor)
    const confidence = Math.max(0, 1 - S_sensor);

    // Clamp to 0-100 just in case
    finalScore = Math.min(100, Math.max(0, finalScore));

    // Classification
    let level = RiskLevel.LOW;
    if (finalScore >= 80) level = RiskLevel.CRITICAL;
    else if (finalScore >= 60) level = RiskLevel.HIGH;
    else if (finalScore >= 30) level = RiskLevel.WARNING;

    // Integrity Level
    let integrity: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL' = 'HIGH';
    if (confidence < 0.3) integrity = 'CRITICAL';
    else if (confidence < 0.5) integrity = 'LOW';
    else if (confidence < 0.8) integrity = 'MEDIUM';

    // Generate Recommendation
    let maxFactor = 'distance';
    let maxVal = contributions.distance;
    if (contributions.relativeSpeed > maxVal) { maxVal = contributions.relativeSpeed; maxFactor = 'relativeSpeed'; }
    if (contributions.density > maxVal) { maxVal = contributions.density; maxFactor = 'density'; }
    if (contributions.topology > maxVal) { maxVal = contributions.topology; maxFactor = 'topology'; }
    if (contributions.infrastructure > maxVal) { maxVal = contributions.infrastructure; maxFactor = 'infrastructure'; }
    if (contributions.sensor > maxVal) { maxVal = contributions.sensor; maxFactor = 'sensor'; }

    let recommendation = "Maintain current situational awareness.";
    if (finalScore > 20) {
        switch (maxFactor) {
            case 'distance': recommendation = "Increase separation distance from nearby agents."; break;
            case 'relativeSpeed': recommendation = "Reduce speed relative to surrounding traffic."; break;
            case 'density': recommendation = "Move to a less crowded area if possible."; break;
            case 'topology': recommendation = "Exercise caution due to complex road geometry (intersection/curve)."; break;
            case 'infrastructure': recommendation = "Return to appropriate infrastructure (e.g., Sidewalk/Cycleway)."; break;
            case 'sensor': recommendation = "Check sensor calibration or move to open sky for better GPS."; break;
        }
    }

    // Update history (keep last 50 points for graph)
    const history = [...previousHistory, { timestamp: Date.now(), value: finalScore }];
    if (history.length > 50) history.shift();

    return {
      value: finalScore,
      level,
      history,
      confidence,
      integrity,
      explanation: {
        contributions,
        formula,
        recommendation
      }
    };
  }

  // --- 1. Spatial Factors ---

  private calculateSpatialFactors(vru: VRU, zones: Zone[]): { 
    score: number, 
    infrastructureTypeScore: number, 
    intersectionProximity: number, 
    roadCurvature: number,
    infrastructureTypeEnum: InfrastructureType
  } {
    // Determine Infrastructure Type
    let infraType = InfrastructureType.ROAD; // Default
    let infraScore = 0.5; // Moderate risk

    // Check if in specific zones (mock logic)
    // In a real app, we'd query a map service
    // Here we simulate based on simple coordinate hashing or mock zones
    
    // Mock: Center of Paris (approx)
    const distToCenter = getDistance(vru.position, { lat: 48.8566, lng: 2.3522 });
    
    if (distToCenter < 30) {
      infraType = InfrastructureType.INTERSECTION;
      infraScore = 0.9;
    } else if (distToCenter < 100) {
      infraType = InfrastructureType.PEDESTRIAN_ZONE;
      infraScore = 0.2;
    } else {
      // Randomly assign ROAD or SIDEWALK based on position for simulation variety
      // Use a deterministic hash of coordinates to keep it stable per location
      const hash = Math.abs(Math.sin(vru.position.lat * 1000 + vru.position.lng * 1000));
      if (hash > 0.7) {
        infraType = InfrastructureType.SIDEWALK;
        infraScore = 0.1;
      } else if (hash > 0.5) {
        infraType = InfrastructureType.CYCLEWAY;
        infraScore = 0.3;
      } else {
        infraType = InfrastructureType.ROAD;
        infraScore = 0.6;
      }
    }

    // Intersection Proximity
    // Normalized: 1 = at intersection, 0 = >100m away
    const intersectionProximity = Math.max(0, 1 - (distToCenter / 100));

    // Road Curvature
    // Mock: based on heading change or just random noise for now
    const roadCurvature = 0.1; // Low curvature by default

    const score = (infraScore + intersectionProximity + roadCurvature) / 3;

    return {
      score,
      infrastructureTypeScore: infraScore,
      intersectionProximity,
      roadCurvature,
      infrastructureTypeEnum: infraType
    };
  }

  // --- 2. Dynamic Factors ---

  private calculateDynamicFactors(vru: VRU, otherVRUs: VRU[], densityRadius: number = 50): {
    score: number,
    relativeSpeed: number,
    agentDistance: number,
    localDensity: number
  } {
    if (otherVRUs.length === 0) {
      return { score: 0, relativeSpeed: 0, agentDistance: 0, localDensity: 0 };
    }

    const CRITICAL_DISTANCE = 5; // meters
    const MAX_REL_SPEED = 15; // m/s (approx 54 km/h)

    let minDistance = Infinity;
    let maxRelSpeed = 0;
    let densityCount = 0;

    otherVRUs.forEach(other => {
      if (other.id === vru.id) return;

      const dist = getDistance(vru.position, other.position);
      
      // Density
      if (dist < densityRadius) {
        densityCount++;
      }

      // Distance
      if (dist < minDistance) {
        minDistance = dist;
      }

      // Relative Speed (only if close enough to matter, e.g., < 50m)
      if (dist < 50) {
        const dvx = vru.velocity.x - other.velocity.x;
        const dvy = vru.velocity.y - other.velocity.y;
        const relSpeed = Math.sqrt(dvx*dvx + dvy*dvy);
        if (relSpeed > maxRelSpeed) {
          maxRelSpeed = relSpeed;
        }
      }
    });

    // Normalize
    // Distance: 1 = touching (0m), 0 = >20m
    const normDistance = minDistance < 20 ? (1 - (minDistance / 20)) : 0;
    
    // Speed: 1 = >MAX_REL_SPEED, 0 = 0
    const normSpeed = Math.min(1, maxRelSpeed / MAX_REL_SPEED);

    // Density Calculation: Count / Area
    // Area = PI * R^2
    const area = Math.PI * densityRadius * densityRadius;
    const rawDensity = densityCount / area; // VRUs per m^2
    
    // Normalize Density
    // Assume Critical Density = 0.05 VRUs/m^2 (approx 1 VRU per 20m^2 for mixed traffic)
    // Adjust this threshold based on requirements. 
    // For 50m radius, area is ~7850m^2. 
    // If 10 VRUs are nearby, density is 10/7850 = 0.0012. This is very low.
    // Let's use a simpler heuristic for normalization that scales with radius.
    // If radius is small (5m), area is 78m^2. 2 people is 0.025.
    // Let's stick to the user's formula but normalize it against a "High Density Threshold".
    // Let's say High Density is when there are > 10 VRUs in a 50m radius.
    // That density is 10 / (PI*50^2) = 0.00127.
    // So we can normalize by dividing by this reference density.
    // Reference Density = 10 / (PI * 50^2) ~= 0.00127
    // Or let's just use a count-based heuristic scaled by radius ratio?
    // No, user asked for Density = Count / Area.
    // Let's define MAX_DENSITY = 0.01 (1 VRU per 100m^2).
    const MAX_DENSITY = 0.01; 
    const normDensity = Math.min(1, rawDensity / MAX_DENSITY);

    const score = (normDistance * 0.5) + (normSpeed * 0.3) + (normDensity * 0.2);

    return {
      score,
      relativeSpeed: normSpeed,
      agentDistance: normDistance,
      localDensity: normDensity
    };
  }

  // --- 3. Infrastructure Compatibility ---

  private calculateInfrastructureCompatibility(vru: VRU, infraType: InfrastructureType): {
    score: number,
    infrastructureMismatch: number
  } {
    // Define compatibility matrix (0 = compatible, 1 = incompatible)
    const compatibilityMatrix: Record<VRUType, Partial<Record<InfrastructureType, number>>> = {
      [VRUType.PEDESTRIAN]: {
        [InfrastructureType.SIDEWALK]: 0,
        [InfrastructureType.PEDESTRIAN_ZONE]: 0,
        [InfrastructureType.CROSSWALK]: 0,
        [InfrastructureType.CYCLEWAY]: 0.8,
        [InfrastructureType.ROAD]: 1.0,
        [InfrastructureType.INTERSECTION]: 0.9
      },
      [VRUType.CYCLIST]: {
        [InfrastructureType.CYCLEWAY]: 0,
        [InfrastructureType.ROAD]: 0.2,
        [InfrastructureType.SIDEWALK]: 0.8,
        [InfrastructureType.PEDESTRIAN_ZONE]: 0.8,
        [InfrastructureType.INTERSECTION]: 0.5,
        [InfrastructureType.CROSSWALK]: 0.6
      },
      [VRUType.SCOOTER]: {
        [InfrastructureType.CYCLEWAY]: 0,
        [InfrastructureType.ROAD]: 0.2,
        [InfrastructureType.SIDEWALK]: 0.8,
        [InfrastructureType.PEDESTRIAN_ZONE]: 0.8,
        [InfrastructureType.INTERSECTION]: 0.5,
        [InfrastructureType.CROSSWALK]: 0.6
      },
      [VRUType.WHEELCHAIR]: {
        [InfrastructureType.SIDEWALK]: 0,
        [InfrastructureType.PEDESTRIAN_ZONE]: 0,
        [InfrastructureType.CROSSWALK]: 0,
        [InfrastructureType.CYCLEWAY]: 0.8,
        [InfrastructureType.ROAD]: 1.0,
        [InfrastructureType.INTERSECTION]: 0.9
      },
      [VRUType.VEHICLE]: {
        [InfrastructureType.ROAD]: 0,
        [InfrastructureType.INTERSECTION]: 0.2,
        [InfrastructureType.CROSSWALK]: 0.5,
        [InfrastructureType.SIDEWALK]: 1.0,
        [InfrastructureType.CYCLEWAY]: 1.0,
        [InfrastructureType.PEDESTRIAN_ZONE]: 1.0
      },
      [VRUType.MOTORCYCLE]: {
        [InfrastructureType.ROAD]: 0,
        [InfrastructureType.INTERSECTION]: 0.2,
        [InfrastructureType.CROSSWALK]: 0.5,
        [InfrastructureType.SIDEWALK]: 1.0,
        [InfrastructureType.CYCLEWAY]: 1.0,
        [InfrastructureType.PEDESTRIAN_ZONE]: 1.0
      }
    };

    const mismatch = compatibilityMatrix[vru.type]?.[infraType] ?? 0.5; // Default to 0.5 if unknown

    return {
      score: mismatch,
      infrastructureMismatch: mismatch
    };
  }

  // --- 4. Sensor Confidence ---

  private calculateSensorConfidence(vru: VRU): {
    score: number,
    gpsAccuracy: number,
    reliabilityScore: number
  } {
    // Assume primary sensor is the first one or aggregate
    const primarySensor = vru.sensors[0];
    
    if (!primarySensor) {
      return { score: 1, gpsAccuracy: 1, reliabilityScore: 1 }; // High risk if no sensors
    }

    // GPS Accuracy (RMSE)
    // Normalize: 0 = perfect (0m), 1 = bad (>10m)
    const accuracy = primarySensor.accuracy || 0;
    const normAccuracy = Math.min(1, accuracy / 10);

    // Reliability Score
    // 1 = reliable, 0 = unreliable
    // Inverted for risk: 0 = reliable (low risk), 1 = unreliable (high risk)
    const reliability = primarySensor.active ? 0.1 : 0.9; // 0.1 base risk even if active

    const score = (normAccuracy + reliability) / 2;

    return {
      score,
      gpsAccuracy: normAccuracy,
      reliabilityScore: reliability
    };
  }
}

export const riskFactorEngine = new RiskFactorEngine();
