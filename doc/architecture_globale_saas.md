# Architecture Globale de la Plateforme VRUGuard (Solution SaaS)

La plateforme VRUGuard a été pensée et conçue comme une **Solution SaaS (Software as a Service)** basée sur une architecture Cloud-Native, distribuée et Multiplateforme (Cross-Platform). Cette approche garantit une haute disponibilité, une évolutivité (scalabilité) face à un grand nombre d'utilisateurs connectés, et une maintenance centralisée.

L'architecture s'articule autour d'un socle d'**Edge Computing** (traitements lourds effectués sur le téléphone de l'utilisateur) et de **Microservices Logiques** (séparation des responsabilités en différents modules de services).

Voici la description détaillée des différentes strates (Tiers) de l'architecture et de l'ensemble des services qui la composent.

---

## 1. La Couche Mobile/Client (Edge & Cross-Platform Layer)

C'est la partie de l'application qui s'exécute sur l'appareil de l'utilisateur (Smartphone Android/iOS, Navigateur Web). Construite avec **React, Vite et Capacitor**, elle assure une base de code unique (Cross-Platform) tout en conservant un accès hybride aux capacités natives du téléphone.
Ce "Client Lourd" effectue en local une grande partie des calculs algorithmiques pour alléger les serveurs Cloud : c'est le principe du **Edge Computing**.

---

## 2. La Couche des Services Métiers (Business Logic Layer)

Cette strate est le cœur intellectuel de VRUGuard. Au lieu d'avoir un code monolithique, la logique est découpée en **Services indépendants** (`services/*.ts`), garantissant un couplage lâche et une évolutivité propre. Ces services sont regroupés en 5 grands domaines applicatifs :

### A. Domaine de la Télémétrie et de la Navigation
Ces services gèrent tout ce qui a trait à la position dans l'espace et au déplacement.
*   **`AdvancedGeolocationService` & `GeolocationService` :** Orchestrent l'écoute des signaux GPS du téléphone, nettoient les bruits de fond et transmettent une position standardisée au système.
*   **`TcpClientPlugin` (Plugin Natif) :** Gère la connexion réseau socket de très bas niveau pour se lier à des antennes GNSS professionnelles externes (Mode TERIA), contournant les pare-feux web.
*   **`MapMatchingService` :** Un algorithme mathématique complexe qui "plaque" (snap) la coordonnée GPS brute imprécise sur la trajectoire exacte de la route ou du trottoir (réseau routier topographique).
*   **`RoutingService` :** Calcule les itinéraires d'un point A à un point B de manière algorithmique.
*   **`OverpassService` & `GeocodingService` :** Communiquent avec les API cartographiques (comme OpenStreetMap) pour extraire les vecteurs des routes, bâtiments, et convertir des adresses en coordonnées (et inversement).

### B. Domaine de l'Analyse des Risques et Prévention IA
Le cœur sécuritaire de l'application. Ces services analysent continuellement le danger.
*   **`RiskEngine` & `RiskFactorEngine` :** Moteurs qui évaluent le niveau de danger d'une position donnée en fonction de paramètres multiples (vitesse, croisements, piétons proches).
*   **`MultiplicativeRiskModel` & `WeightOptimizer` :** Modèles mathématiques stochastiques qui calculent des probabilités de collisions. L'optimiseur ajuste mathématiquement les poids des variables (selon des modèles prédictifs, parfois inspirés d'algorithmes de recuit simulé ou quantique via le **`QuantumService`**).
*   **`RiskFieldService` :** Convertit les données mathématiques de risque en champs de potentiel affichables visuellement (Génération des Heatmaps de danger sur la carte).
*   **`TopologyAnalyzer` :** Scanne la structure environnementale (virages aveugles, pentes) pour détecter des vulnérabilités statiques du terrain.

### C. Domaine de Collision V2X et de l'Urgence
Les modules déclenchés lors d'une détection d'événement critique.
*   **`V2XService` :** Émule et gère la communication Vehicle-to-Everything. Il s'occupe du broadcast (diffusion) de la position de l'usager vers le trafic alentour virtuellement.
*   **`SosService` :** Service d'urgence critique de niveau 0. Orchestre le déclenchement d'une alerte maximale, outrepassant les modes silencieux pour contacter le backend le plus vite possible.
*   **`IncidentService` :** Gère le cycle de vie applicatif (CRUD) des obstacles ou incidents rapportés par le crowdsourcing (signalements participatifs).
*   **`ZoneSafetyService` & `PmrService` :** Surveillent des polygones géographiques (GeoFencing) pour invalider spécifiquement des zones pour les utilisateurs cibles (ex: blocage d'une rue pour les PMR).

### D. Domaine des Réseaux de Soins (Care Networks & Synchronous Data)
Ces services gèrent tout ce qui relève du lien social protecteur et du partage interactif entre utilisateurs.
*   **`LiveTrackingService` & `LiveInteractionService` :** Des courtiers en messages qui traitent et répercutent en temps réel la position des autres agents connectés dans les parages sur l'interface de l'usager.
*   **`TripRoomService` :** Logique d'instanciation de sessions privées pour partager son trajet avec un groupe restreint via code PIN.
*   **`ParentalService` :** Orchestrateur asynchrone chargé spécifiquement de vérifier en arrière-plan (Background) si un enfant (VRU traqué) quitte sa zone autorisée, puis notifie les parents.
*   **`TrustService` :** Autorisations cryptographiques et algorithmiques permettant d'attribuer des droits de regard temporaires d'une télémétrie locale vers un tiers de confiance.
*   **`conversationsService` & `presenceService` :** Moteurs de flux de messagerie instantanée (Chat in-app) et de statut de présence (En ligne/Hors ligne) indispensables pour la coordination des escortes numériques.

### E. Domaine d'Assistance, Simulation et Reporting
Services annexes assurant que la plateforme tourne correctement et interagit proprement avec l'humain.
*   **`VoiceAssistantService` & `AudioGuidanceService` :** Transcription Text-to-Speech (TTS) et écoute des commandes biométriques pour opérer l'affichage d'alertes "Hands-Free" dans les oreillettes du VRU.
*   **`SimulationService` :** Un générateur métier complexe (Stress Test) capable de faire spawner et interpoler les mouvements de milliers de VRUs fictifs pour vérifier la tenue en charge de la plateforme et valider les algorithmes d'évitement.
*   **`ReportService`, `ReportGenerator` & `ReportLocalization` :** Génèrent de la télémétrie historique, créant des logs analytiques de l'état du système exploitables après un incident à des fins de Big Data ou légales.
*   **`AppFeedbackService` :** Recueille les notes de l'interface et les remarques UX pour l'amélioration continue du produit MVP.

---

## 3. La Couche Cloud & Backend-as-a-Service (BaaS)

Au lieu de déployer un serveur PHP/Node classique sujet aux goulots d'étranglement (bottle-necks), VRUGuard adopte l'approche **Serverless** via Firebase.
*   **`AuthService` / Firebase Auth :** Fournit le JWT (JSON Web Tokens) sécurisant de façon indivisible chaque roquette.
*   **`FirebaseService` / Firestore (NoSQL) :** La base de données documentaire agit en rôle de routeur Pub/Sub natif. Dès qu'un usager écrit sa position dans le Cloud, Firestore "pousse" instantanément (Push WebSocket) l'information vers tous les usagers de la zone. C'est l'épine dorsale du temps-réel de l'aspect SaaS.

## 4. La Couche des Systèmes Tiers et APIs Externes

Le SaaS n'est pas isolé, il dialogue par micro-transactions API avec l'écosystème :
*   **L'Intelligence Artificielle Google Gemini (Sentinelle) :** Requêtage externe par l'Agent Sentinelle pour analyser sémantiquement des données météorologiques et textuelles.
*   **Réseaux Météorologiques externes (`weatherService`) :** Enrichissement du modèle mathématique des frictions du sol selon de la data d'environnement (API météo).
*   **Le Réseau Matériel TERIA :** Les antennes de précision et diffuseurs de correction de phase NMEA.

---

## Synthèse : Pourquoi cette architecture SaaS est-elle novatrice ?

Cette architecture est pensée comme un bouclier numérique réactif. En déplaçant l'analyse mathématique des collisions depuis le serveur distant (Cloud) directement dans la mémoire vive du téléphone (Edge Computing via `RiskEngine`), la latence systémique est foudroyée. Le Cloud (Firebase) ne sert alors que de bus de messagerie haute vitesse et de coffre-fort sécurisé, ce qui permet à la plateforme SaaS de rester extrêmement légère, peu coûteuse en hébergement serveur et tolérante aux pertes temporaires de réseau 4G/5G.
