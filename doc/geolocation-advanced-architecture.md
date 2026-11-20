# Architecture Avancée de Géolocalisation (Précision < 0.5m)

## 1. Haute Précision Native
L'application force `enableHighAccuracy: true` dans tous ses appels de géolocalisation pour forcer l'usage matériel de la puce GNSS au lieu de la seule triangulation Wi-Fi.

## 2. Fusion de Capteurs (Sensor Fusion / Fused Location)
La plateforme utilise le composant `AdvancedGeolocationService` qui combine de manière réactive le signal GPS avec l'IMU (Inertial Measurement Unit) du téléphone (accéléromètre + orientation) pour calculer un déplacement en "Dead Reckoning" lors de pertes de signal ou de fluctuations (par exemple dans des zones urbaines denses (canyons urbains) ou des tunnels).

## 3. Prise en charge du matériel spécialisé (Dual-Band / RTK)
L'utilisation de puces GNSS double fréquence (L1/L5) sur les smartphones récents (par ex. Snapdragon récents, Pixel, iPhone 14 Pro+) permet une correction WAAS/EGNOS native.
L'architecture de la plateforme intègre la remontée des capacités et statuts RTK (Real-Time Kinematic) externes via des flags avancés dans le profil de chaque suivi de personne (Interface `VRU`).
Dans le code, le `SimulationService` trace désormais:
- `locationIsDualBand` (Indicateur que la puce filtre le signal multi-fréquence)
- `locationCorrectionType: 'WAAS' | 'EGNOS' | 'RTK'`
- `locationRtkFixed: boolean` (Fixation du RTK pour un tracking sub-mètre strict au centimètre près).

## 4. Recommandations de SDKs pour une précision Industrielle
Bien que l'API HTML5 fournisse d'excellents résultats avec l'interface `enableHighAccuracy`, voici les recommandations d'outils que la plateforme peut coupler (wrapper) pour atteindre l'excellence pour les deux roues (motards, coursiers vélo) :
1. **Mapbox Navigation SDK (iOS/Android)** : Contient un algorithme interne exclusif (Mapbox Fused Location Engine) qui colle le traceur à la voie réelle et ignore les sauts parasites bien plus efficacement que Google Maps Standard. Recommandé une fois la partie mobile compilée (React Native / Capacitor native plugin).
2. **HERE Positioning API** : Utilisé via leur SDK natif, croise activement le SLAM Bluetooth, le Wi-Fi RTT 802.11mc et les signaux GPS Dual-Band. C'est l'un des leaders pour le "lane-level positioning" (positionnement sur une voie spécifique, utile pour identifier si la moto est sur la voie de gauche ou de droite).
3. **Usage de Récepteurs GNSS Externes** : Si les cyclistes ou livreurs sont professionnels, appairer l'appareil avec un dôme/petit boîtier GPS RTK (ex. intégrant u-blox ZED-F9P) transmettant les cordonnées corrigées par Bluetooth Mock Location Override. Notre plateforme traitera cette donnée avec la configuration `rtkFixed: true`.

Toutes ces abstractions sont illustrées de façon interactive dans le Tableau de bord qui affiche dynamiquement l'état de précision ("Precision 0.5m", "Dual-Band", "RTK") grâce à des Tooltips intégrés pour les opérateurs de suivi.
