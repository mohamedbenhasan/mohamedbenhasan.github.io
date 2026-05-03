# Spécifications Techniques Détaillées - VRU-GUARD

## 1. Présentation de la Plateforme
**VRU-GUARD** (Quantum-Powered Vulnerable Road User Protection) est une plateforme de simulation et de protection en temps réel pour les usagers vulnérables de la route (VRU). Elle intègre des concepts avancés tels que la fusion de capteurs (inspirée de la logique quantique), l'analyse prédictive des risques, le routage adaptatif basé sur l'infrastructure réelle (OpenStreetMap) et les communications V2X (Vehicle-to-Everything).

---

## 2. Architecture Globale et Arborescence

L'application est une Single Page Application (SPA) React propulsée par Vite, avec un backend Serverless Firebase.

```text
src/
├── components/          # Composants UI React
│   ├── Dashboard.tsx    # Contrôleur principal de la vue
│   ├── MapComponent.tsx # Rendu de la carte (Leaflet/React-Leaflet)
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
│   └── FirebaseService.ts       # Interactions avec Firestore
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
    *   `reading` : Coordonnées lues (bruitées).
*   **`DENMMessage`** (Decentralized Environmental Notification Message) :
    *   `id`, `eventType` (COLLISION_RISK, etc.), `location`, `riskLevel`
    *   `geohash` : Pour le filtrage spatial.
    *   `expiresAt` : Timestamp d'expiration (TTL).

### 3.2. Schéma Firestore (`firebase-blueprint.json`)
La base de données est structurée pour stocker l'historique et les événements en temps réel :
*   `/users/{userId}` : Profils (RBAC : ADMIN, OPERATOR).
*   `/sessions/{docId}` : Enregistrement des sessions (durée, métriques d'erreur moyenne, alertes).
*   `/denm_events/{docId}` : Messages V2X éphémères.
*   `/risk_data/{docId}` & `/tracking_data/{docId}` : Télémétrie pour analyse a posteriori.

---

## 4. Moteur de Simulation et Algorithmes Détaillés

### 4.1. SimulationService (Le Cœur)
*   **Boucle de Simulation (`tick`)** : S'exécute via `setInterval` toutes les 100ms.
*   **Cinématique** : Met à jour la position des entités non contrôlées par l'utilisateur via la formule : $Position_{nouvelle} = Position_{actuelle} + (Velocite \times \Delta t)$.
*   **Bruitage** : Ajoute un bruit aléatoire aux lectures des capteurs basé sur leur `accuracy` nominale.
*   **Routage Adaptatif** : Toutes les 5 secondes, si une destination est définie, le service appelle le `RoutingService` en arrière-plan pour recalculer l'itinéraire en fonction de la nouvelle grille de risque.

### 4.2. RiskEngine & RiskFactorEngine (Calcul des Collisions)
*   **TTC (Time-To-Collision)** : Calcule le temps avant impact basé sur la distance relative et la vitesse de rapprochement.
    *   $V_{rel} = V_{autre} - V_{user}$ (Projection vectorielle)
    *   $TTC = \frac{Distance}{V_{rel}}$ (si $V_{rel} > 0$)
*   **Probabilité de Collision** : Fonction inversement proportionnelle au TTC et à la distance, pondérée par l'erreur de localisation (incertitude).
*   **Facteurs de Risque** : Analyse contextuelle (vitesse excessive, zone scolaire, conditions météo simulées).

### 4.3. RiskFieldService (Grille Spatiale de Risque)
Génère une carte de chaleur (heatmap) des dangers.
*   **Résolution Dynamique** : La taille des cellules varie de 5m à 40m selon le niveau de zoom de la carte.
*   **Accumulation Gaussienne** : Chaque véhicule projette un risque devant lui.
    *   $Influence = e^{-(\frac{x_{rel}^2}{2\sigma_{long}^2} + \frac{y_{rel}^2}{2\sigma_{lat}^2})}$
    *   $\sigma_{long}$ (portée avant) augmente avec la vitesse du véhicule.
*   **Intégration DENM** : Les messages V2X ajoutent un risque statique circulaire avec une décroissance linéaire autour de leur épicentre.

### 4.4. RoutingService (Routage Légal et Sécurisé)
*   **Fastest Route** : Requête HTTP vers l'API publique OSRM (`router.project-osrm.org`).
*   **Safest Route (A* sur Graphe OSM)** :
    1.  **Extraction** : Récupère les voies (`ways`) depuis `InfrastructureService`.
    2.  **Graphe** : Construit un graphe bidirectionnel où les nœuds sont les coordonnées OSM et les arêtes sont les segments de route.
    3.  **Snapping** : Projette le point de départ et d'arrivée sur les nœuds les plus proches du graphe.
    4.  **Algorithme A*** :
        *   $g(n)$ : Coût de mouvement = $Distance + (RiskValue^2 \times RiskWeight \times 10)$. Le risque est mis au carré pour pénaliser lourdement les zones dangereuses.
        *   $h(n)$ : Heuristique = Distance à vol d'oiseau (Haversine) jusqu'à la destination.
    5.  **Lissage** : Applique une moyenne mobile simple sur le chemin résultant pour adoucir les angles.

### 4.5. QuantumFusionService (Fusion de Capteurs)
Simule un filtre de Kalman simplifié (fusion par variance inverse).
*   **Poids du capteur ($W_i$)** : $W_i = \frac{1}{Accuracy_i^2}$
*   **Position Estimée** : $\frac{\sum (Reading_i \times W_i)}{\sum W_i}$
*   **Marge d'Erreur Résiduelle** : $\sqrt{\frac{1}{\sum W_i}}$
*   *Résultat* : Plus l'utilisateur active de capteurs précis, plus son erreur de localisation diminue, réduisant ainsi les faux positifs dans le calcul des collisions.

### 4.6. InfrastructureService (OpenStreetMap)
*   **Requête Overpass QL** : Récupère les géométries des routes (`highway=*`) dans la bounding box actuelle.
*   **Mise en cache** : Stocke les voies localement. Ne refait une requête que si la vue de la carte se déplace de plus de 50 mètres en dehors de la zone en cache.

### 4.7. V2XService (Communication)
*   **Broadcast** : Lorsqu'un risque CRITICAL ou HIGH est détecté, un message DENM est écrit dans Firestore.
*   **Geohashing** : Utilise la librairie `ngeohash` (précision 7, environ 150m) pour indexer spatialement les messages.
*   **TTL (Time-To-Live)** : Les messages expirent après 60 secondes. Un processus de nettoyage supprime les documents obsolètes de Firestore.

---

## 5. Sécurité et Règles Firestore (Security Rules)

Les règles Firestore (`firestore.rules`) implémentent une sécurité de niveau production :
*   **Validation de Schéma (Type Checking)** : Chaque écriture est vérifiée par des fonctions dédiées.
    *   *Exemple* : `isValidSessionRecord(data)` vérifie que `duration` est un nombre $\ge 0$, que `metrics` contient bien `avgError`, `collisionWarnings`, etc.
*   **Protection des Identifiants (UID Protection)** : `data.userId == request.auth.uid` garantit qu'un utilisateur ne peut écrire des données que pour lui-même.
*   **Immutabilité** : Les règles d'`update` utilisent `areImmutableFieldsUnchanged(['uid', 'createdAt'])` pour empêcher la falsification de l'historique.
*   **RBAC** : Les suppressions (`delete`) et les accès globaux sont strictement réservés aux utilisateurs ayant le rôle `ADMIN` dans leur profil.

---

## 6. Interface Utilisateur (UI) et Rendu

*   **React Leaflet** : Utilisé pour le rendu cartographique performant.
    *   Les VRUs sont rendus sous forme de `Marker` avec des icônes personnalisées (Lucide-react converties en divIcon).
    *   La grille de risque est rendue via des `Rectangle` SVG dont l'opacité dépend de la valeur de risque (Heatmap).
    *   Les itinéraires sont tracés via des `Polyline` (Bleu pour Fastest, Vert/Orange pour Safest).
*   **Gestion d'État UI** : Utilisation intensive des hooks (`useState`, `useEffect`, `useRef`). Les données à haute fréquence (comme la position exacte pour l'animation) utilisent des `ref` pour éviter des re-rendus React inutiles, optimisant ainsi les performances à 10 FPS (100ms tick).
*   **Composants Shadcn UI** : Utilisation de composants accessibles (Card, Button, Badge, Switch) stylisés avec Tailwind CSS.

---

## 7. Déploiement et Build

*   **Outil de Build** : Vite (Esbuild sous le capot).
*   **Variables d'Environnement** : Les clés API (Firebase, etc.) sont injectées au build via `import.meta.env`.
*   **Compatibilité** : Le bundle généré dans `/dist` est purement statique (HTML/CSS/JS) et peut être servi par n'importe quel serveur web statique ou CDN (Firebase Hosting, Vercel, Cloud Run).
