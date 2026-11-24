import { ReportLanguage } from './types';
import { RiskAnalysis } from './types';
import { OptimizationContext } from '../../types';

export class NarrativeGenerator {
  static generateFallback(lang: ReportLanguage, analysis: RiskAnalysis, context: OptimizationContext): string {
    const isFrench = lang === 'FR';
    
    const riskDesc = isFrench ? 
      (analysis.riskLevel === 'CRITICAL' ? 'Critique' : analysis.riskLevel === 'HIGH' ? 'Élevé' : analysis.riskLevel === 'MEDIUM' ? 'Modéré' : 'Faible') :
      analysis.riskLevel;

    const dominantFactor = analysis.dominantFactor.name;
    const env = context.environment;

    if (isFrench) {
      return `Analyse Automatisée : La session a enregistré un niveau de risque global ${riskDesc} avec un indice de sécurité de ${analysis.safetyIndex.toFixed(1)}/100. ` +
             `Le facteur de risque dominant identifié est "${dominantFactor}" contribuant à ${analysis.dominantFactor.contribution.toFixed(1)}% du score total. ` +
             `L'environnement ${env} a présenté ${analysis.metrics.totalAlerts} alertes critiques nécessitant une attention immédiate. ` +
             `La confiance du système dans cette évaluation est de ${analysis.riskConfidence.toFixed(1)}%.`;
    } else {
      return `Automated Analysis: The session recorded an overall ${riskDesc} risk level with a Safety Index of ${analysis.safetyIndex.toFixed(1)}/100. ` +
             `The dominant risk factor identified was "${dominantFactor}" contributing ${analysis.dominantFactor.contribution.toFixed(1)}% to the total score. ` +
             `The ${env} environment presented ${analysis.metrics.totalAlerts} critical alerts requiring immediate attention. ` +
             `System confidence in this assessment is ${analysis.riskConfidence.toFixed(1)}%.`;
    }
  }

  static getRecommendations(lang: ReportLanguage, analysis: RiskAnalysis): string {
    const isFrench = lang === 'FR';
    const recommendations: string[] = [];

    if (analysis.metrics.avgRisk > 50) {
      recommendations.push(isFrench ? 
        "Réduire la vitesse opérationnelle dans les zones à haute densité." : 
        "Reduce operational speed in high-density zones immediately.");
    }

    if (analysis.dominantFactor.name === 'sensor') {
      recommendations.push(isFrench ?
        "Vérifier l'étalonnage des capteurs GPS et LiDAR." :
        "Verify GPS and LiDAR sensor calibration.");
    }

    if (analysis.metrics.totalAlerts > 5) {
      recommendations.push(isFrench ?
        "Revoir les protocoles d'approche aux intersections." :
        "Review intersection approach protocols.");
    }

    if (recommendations.length === 0) {
      recommendations.push(isFrench ?
        "Maintenir les protocoles de sécurité actuels. Aucun risque majeur détecté." :
        "Maintain current safety protocols. No major risks detected.");
    }

    return recommendations.map(r => `• ${r}`).join('\n');
  }
}
