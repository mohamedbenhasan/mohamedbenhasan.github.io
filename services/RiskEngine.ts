import { VRU, Coordinates, RiskLevel } from '../types';
import { getDistance, moveCoordinate, EARTH_RADIUS } from '../utils/geo';

export class RiskEngine {
  
  /**
   * Predicts the future path of a VRU for a given duration.
   */
  public predictPath(vru: VRU, duration: number = 5, steps: number = 10): Coordinates[] {
    const path: Coordinates[] = [];
    const dt = duration / steps;
    
    let currentPos = vru.position;
    
    for (let i = 1; i <= steps; i++) {
      // Simple linear projection based on current velocity
      // In a real system, this would use Kalman filters or more complex motion models
      const dx = vru.velocity.x * dt * i;
      const dy = vru.velocity.y * dt * i;
      
      const nextPos = moveCoordinate(vru.position, dx, dy);
      path.push(nextPos);
    }
    
    return path;
  }

  /**
   * Calculates Time-To-Collision (TTC) and Collision Probability.
   */
  public assessCollisionRisk(agent: VRU, target: VRU): { 
    ttc: number; 
    probability: number; 
    riskLevel: RiskLevel 
  } {
    // 1. Relative Position Vector (Target - Agent)
    const dx = (target.position.lng - agent.position.lng) * (EARTH_RADIUS * Math.cos(agent.position.lat * Math.PI / 180)) * (Math.PI / 180);
    const dy = (target.position.lat - agent.position.lat) * EARTH_RADIUS * (Math.PI / 180);
    
    // 2. Relative Velocity Vector (Target - Agent)
    // If target is moving towards agent, relative velocity is negative
    const dvx = target.velocity.x - agent.velocity.x;
    const dvy = target.velocity.y - agent.velocity.y;
    
    const dist = Math.sqrt(dx*dx + dy*dy);
    const relSpeed = Math.sqrt(dvx*dvx + dvy*dvy);

    // 3. Calculate TTC
    // We project the relative motion. 
    // TTC is the time when the distance is minimum (CPA - Closest Point of Approach).
    // Formula: t = -(r . v) / (v . v)
    
    const v2 = dvx*dvx + dvy*dvy;
    const dot = dx*dvx + dy*dvy;
    
    let ttc = -1;
    let minDist = dist;
    
    if (v2 > 0.001) {
      ttc = -dot / v2;
      
      // If TTC is positive, they are converging
      if (ttc > 0) {
         const cpaX = dx + dvx * ttc;
         const cpaY = dy + dvy * ttc;
         minDist = Math.sqrt(cpaX*cpaX + cpaY*cpaY);
      }
    }

    // 4. Calculate Probability & Risk Level
    let probability = 0;
    let riskLevel = RiskLevel.SAFE;

    // Safety radius (sum of sizes + margin)
    const safetyRadius = 2.0 + (agent.localizationError + target.localizationError);

    if (dist < safetyRadius) {
      // Already colliding or very close
      probability = 100;
      ttc = 0;
      riskLevel = RiskLevel.CRITICAL;
    } else if (ttc > 0 && ttc < 10) {
      // Converging path
      
      // Probability decays with distance at CPA and Time to CPA
      // If minDist < safetyRadius, collision is likely if course is maintained
      
      if (minDist < safetyRadius) {
        // Direct collision course
        // Probability decreases as time increases (uncertainty grows)
        probability = Math.max(0, 100 - (ttc * 10)); // 10s = 0%, 0s = 100%
      } else if (minDist < safetyRadius * 3) {
        // Near miss
        probability = Math.max(0, 50 - (ttc * 5));
      }

      // Determine Risk Level based on Probability and TTC
      if (probability > 80 || (ttc < 3 && probability > 50)) {
        riskLevel = RiskLevel.CRITICAL;
      } else if (probability > 40 || (ttc < 5 && probability > 20)) {
        riskLevel = RiskLevel.WARNING;
      }
    }

    return { ttc, probability, riskLevel };
  }
}

export const riskEngine = new RiskEngine();
