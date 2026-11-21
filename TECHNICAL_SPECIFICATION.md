# Spécifications Techniques Détaillées - VRU-GUARD

## 1. Présentation de la Plateforme
**VRU-GUARD** (Quantum-Powered Vulnerable Road User Protection) est une plateforme de simulation et de protection en temps réel pour les usagers vulnérables de la route (VRU). Elle intègre des concepts avancés tels que la fusion de capteurs (inspirée de la logique quantique), l'analyse prédictive des risques, le routage adaptatif basé sur l'infrastructure réelle (OpenStreetMap), les communications V2X (Vehicle-to-Everything), ainsi que l'assistance vocale, l'accessibilité PMR, la création de rapports et l'optimisation par IA (Google Gemini).

---

## 2. Architecture Globale et Arborescence

L'application est une Single Page Application (SPA) React propulsée par Vite, avec un backend Serverless Firebase.

```text
src/
├── components/          # Composants UI React
│   ├── Dashboard.tsx    # Contrôleur principal de la vue
│   ├── MapVisualization.tsx # Rendu de la carte (Leaflet/React-Leaflet) avec Dynamic Zoom
│   ├── ...              # Autres composants UI (boutons, modales)
├── services/            # Logique métier et algorithmes (Singletons)
│   ├── SimulationService.ts     # Boucle principale (tick) et état global
│   ├── RiskEngine.ts            # Calculs physiques (TTC, probabilités)
│   ├── RiskFactorEngine.ts      # Évaluation heuristique des risques
│   ├── RiskFieldService.ts      # Grille de risque spatiale (Gaussienne)
│   ├── RoutingService.ts        # Algorithmes de routage (OSRM & A* OSM)
│   ├── QuantumService.ts        # Fusion de capteurs
│   ├── V2XService.ts            # Communication décentralisée (DENM)
│   ├── InfrastructureService.ts # Requêtes Overpass API (OSM)
│   ├── HistoryService.ts        # Gestion de l'historique des sessions
│   ├── FirebaseService.ts       # Interactions avec Firestore
│   ├── AudioGuidanceService.ts  # Synthèse vocale intégrée et signalisation audio
│   ├── VoiceAssistantService.ts # Assistant vocal interactif (Speech Recognition)
│   ├── PmrService.ts            # Calculs d'accessibilité (Personnes à Mobilités Réduites)
│   ├── ReportGenerator.ts       # Génération de rapports analytiques (PDF/Charts)
│   ├── IncidentService.ts       # Signalements communautaires
│   ├── SosService.ts            # Mode d'urgence et live markers SOS
│   ├── weatherService.ts        # Récupération et cache des données météorologiques
│   └── AppFeedbackService.ts    # Enregistrement des retours utilisateurs
├── utils/               # Fonctions utilitaires
│   └── geo.ts           # Calculs géospatiaux (Haversine, projections)
├── types.ts             # Définitions des interfaces TypeScript
├── firebase.ts          # Configuration et initialisation Firebase
└── main.tsx             # Point d'entrée de l'application
```

---

## 3. Modèle de Données et Types (TypeScript & Firestore)

### 3.1. Entités Principales (`types.ts`)

*   **`Coordinates`** : `{ lat: number, lng: number }`
*   **`VRU`** (Vulnerable Road User) :
    *   `id`, `type` (PEDESTRIAN, CYCLIST, VEHICLE, etc.)
    *   `position` (Coordinates réelles), `velocity` ({x, y} en m/s), `heading` (degrés)
    *   `sensors` : Liste de capteurs (GPS, LiDAR, Camera) avec leur état et précision.
    *   `localizationError` : Marge d'erreur après fusion des capteurs.
    *   `riskLevel`, `riskScore`, `riskFactors` : Évaluations de sécurité.
*   **`Sensor`** :
    *   `id`, `type`, `active` (boolean)
    *   `accuracy` : Précision nominale en mètres.
*   **`DENMMessage`** (Decentralized Environmental Notification Message) :
    *   `id`, `eventType`, `location`, `riskLevel`, `geohash`, `expiresAt`
*   **`Incident`** / **`SOS Alert`** : Événements déclarés en temps réel.

### 3.2. Schéma Firestore (`firebase-blueprint.json`)
*   `/users/{userId}` : Profils (RBAC : ADMIN, OPERATOR).
*   `/sessions/{docId}` : Enregistrement des sessions et feedback utilisateurs.
*   `/denm_events/{docId}` : Messages V2X éphémères.
*   `/incidents/{docId}` : Signalement d'incidents par la communauté.
*   `/sos_alerts/{docId}` : Alertes d'urgence actives.
*   `/risk_data/{docId}` & `/tracking_data/{docId}` : Télémétrie technique.

---

## 4. Moteur de Simulation et Services Détaillés

### 4.1. SimulationService (Le Cœur)
*   **Boucle de Simulation (`tick`)** : S'exécute via `setInterval` toutes les 100ms.
*   **Cinématique et Bruitage** : Mise à jour des positions selon velocité et capteurs.
*   **Routage Adaptatif** : L'itinéraire est recalculé contextuellement face aux nouvelles grilles de risque, de météo ou des alertes d'incident en temps réel.

### 4.2. RoutingService & InfrastructureService (OSRM & A* OSM)
*   Routes générées via un modèle d'A* customisé et OSM, croisé avec OSRM pour la distance minimale.
*   Le routage réagit dynamiquement au poids de risque (ajustable par l'utilisateur).

### 4.3. QuantumFusionService (Fusion de Capteurs)
*   Simule un filtre de Kalman simplifié : $W_i = \frac{1}{Accuracy_i^2}$.
*   Gère dynamiquement l'optimisation énergétique/précision suivant les recommandations de l'IA.

### 4.4. PMR Service (Accessibilité PMR)
*   **Analyse Itinéraire** : Évalue les segments de routes pour la compatibilité fauteuil roulant.
*   **Critères PMR** : Type de route, présence de trottoirs, évitement d'obstacles communautaires, évaluation sur 3 statuts géolocalisés (ADAPTE, PARTIELLEMENT_ADAPTE, NON_ADAPTE).

### 4.5. Guidage Audio & Assistant Vocal
*   **AudioGuidanceService** : Basé sur `window.speechSynthesis`. Annonces automatiques (itinéraires, risques, zones critiques). Activé par défaut pour les personnes à besoins spécifiques. Modules supportant le multilinguisme (FR/EN) et réglage de la vitesse.
*   **VoiceAssistantService** : Basé sur `window.SpeechRecognition` (ou `webkitSpeechRecognition`). Utilisé pour écouter les commandes des utilisateurs interactivement. Le bouton micro est accessible en permanence en bas de l'écran.

### 4.6. Intégration IA (Gemini 3.1 Pro)
*   Le tableau de bord utilise `@google/genai` pour générer :
    *   **Recommandations de sécurité** contextuelles basées sur l'environnement.
    *   **Analyses RMSE** calculant l'amélioration de la perception par rapport aux données brutes.
    *   **Optimisation de Capteurs** ("AI Sentinel Quantum Model") pour sélectionner les meilleurs outils hardware du VRU en fonction des contraintes de couverture/batterie.

### 4.7. Signalements et SOS
*   **Mode SOS** : Broadcast d'urgence activant des marqueurs rouges sur toutes les cartes du réseau.
*   **Incidents Collaboratifs** : Interface permettant le clic sur la carte pour signaler temporairement un accident ou un obstacle matériel (très utile en mode PMR et V2X).

---

## 5. Interface Utilisateur (UI), Expérience & Rendu

*   **Rendu Leaflet Avancé** :
    *   `MapVisualization.tsx` rend VRUs, Heatmap Gaussienne de risque, Lignes sécurisées.
    *   **Zoom Dynamique & Auto Focus** : L'auto-zoom de suivi est désactivé par défaut, mais assure tout de même d'effectuer un premier focus immédiat sur la position GPS de l'utilisateur à l'ouverture de l'application. 
    *   **Auto Nav Panel** : Affiche automatiquement le panneau de navigation sitôt une destination déterminée par l'utilisateur. Cache automatique à l'appui.
*   **Rapports & Feedback** : Outil natif de génération de rapport de fin de session en PDF combinant Recharts via l'historique et des statistiques.
*   **Shadcn UI & Tailwind CSS** : Composants optimisés avec de la translucidité (glassmorphism), thème sombre cyber-technologique.

---

## 6. Sécurité et Règles Firestore

Les règles Firestore (`firestore.rules`) implémentent une sécurité de niveau production :
*   Protection absolue par `request.auth.uid`.
*   Validation fine des champs via `hasOnly()` (Update-Gaps fermés).
*   Structure stricte sur `incidents` et `sos_alerts` pour éviter le spam réseau.
*   Utilisation stricte des variables de temps `request.time` pour les logs de télémétrie.

---

## 7. Déploiement et Build

*   **Outil de Build** : Vite (Esbuild), React 18, TypeScript strict.
*   **Variables** : Gérées via `import.meta.env` (VITE_GEMINI_API_KEY, config Firebase).
*   Architecture prête pour Cloud Run ou hébergement statique (Firebase Hosting, Vercel).
