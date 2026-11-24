export type ImpactLevel = 'Low' | 'Medium' | 'High';

export interface EnvironmentImpact {
  slippery: ImpactLevel;
  heat: ImpactLevel;
  visibility: ImpactLevel;
  wind: ImpactLevel;
  adviceText: string[];
}

export function computeImpact(current: any, hourly: any, nowLocal: Date): EnvironmentImpact {
  let slippery: ImpactLevel = 'Low';
  let heat: ImpactLevel = 'Low';
  let visibility: ImpactLevel = 'Low';
  let wind: ImpactLevel = 'Low';
  const adviceText: string[] = [];

  const temp = current.temperature_2m ?? 20;
  const humidity = current.relative_humidity_2m ?? 50;
  const precip = current.precipitation ?? 0;
  const gusts = current.wind_gusts_10m ?? 0;
  
  // Find current hour index for hourly data
  const currentHour = nowLocal.getHours();
  let vis = 10000; // default good visibility
  if (hourly && hourly.visibility && hourly.visibility.length > currentHour) {
    vis = hourly.visibility[currentHour];
  }

  // Slippery
  if (precip > 0.5 && temp < 7) {
    slippery = 'High';
    adviceText.push("Risque de verglas ou neige : réduisez votre vitesse et évitez les freinages brusques.");
  } else if (precip > 0 || temp < 3) {
    slippery = 'Medium';
    if (precip > 0) {
      adviceText.push("Pluie détectée : privilégiez les routes éclairées et évitez les surfaces glissantes.");
    } else {
      adviceText.push("Températures basses : attention aux plaques de givre possibles.");
    }
  }

  // Heat
  if (temp >= 32 || (temp >= 28 && humidity >= 70)) {
    heat = 'High';
    adviceText.push("Forte chaleur : hydratez-vous et évitez les efforts intenses.");
  } else if (temp >= 28) {
    heat = 'Medium';
    adviceText.push("Chaleur modérée : pensez à vous hydrater.");
  }

  // Wind
  if (gusts >= 45) {
    wind = 'High';
    adviceText.push("Vent fort : prudence pour cyclistes/trottinettes, risque de déviation.");
  } else if (gusts >= 30) {
    wind = 'Medium';
    adviceText.push("Rafales modérées : gardez les deux mains sur le guidon/volant.");
  }

  // Visibility
  if (vis < 2000) {
    visibility = 'High';
    adviceText.push("Visibilité très réduite : allumez vos feux et augmentez les distances de sécurité.");
  } else if (vis < 5000) {
    visibility = 'Medium';
    adviceText.push("Visibilité moyenne : soyez attentifs aux autres usagers.");
  } else if (precip > 2 && (currentHour < 7 || currentHour > 19)) {
    visibility = 'Medium';
    adviceText.push("Pluie nocturne : visibilité potentiellement dégradée.");
  }

  if (adviceText.length === 0) {
    adviceText.push("Conditions optimales pour vos déplacements.");
  }

  return { slippery, heat, visibility, wind, adviceText };
}
