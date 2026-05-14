# VRUGuard : Plateforme de Sécurité Hybride pour VRU

**Note orateur globale :** "Bonjour à tous. Aujourd'hui, je vous présente VRUGuard, une plateforme innovante dédiée à la sécurité des usagers vulnérables de la route (VRU). Notre objectif est de transformer le smartphone en un bouclier actif grâce à la fusion de données et l'intelligence artificielle."

---

## Slide 1 — Le Problème : Pourquoi les VRU sont-ils en danger ?
**Objectif :** Exposer les failles des systèmes de localisation actuels.
* **Contenu :**
  * Les systèmes GPS standards manquent de précision en milieu urbain dense (canyons urbains).
  * Les solutions actuelles ignorent le **profil de l'utilisateur** (ex: PMR, cycliste).
  * Les conditions météorologiques et dynamiques ne sont pas prises en compte.
  * Charge cognitive trop élevée pour les usagers en mouvement.
* **Détails techniques :**
  * Erreur GPS standard : 5-15 mètres (insuffisant pour la prévention de collision).
  * Manque de fusion de données multi-sources (Radar, LiDAR, V2X).
* **Note orateur :** "Les outils de navigation classiques se contentent de vous guider. Mais dans un environnement complexe, une erreur GPS de 5 mètres ou l'ignorance des conditions météo ou d'un handicap peut être fatale pour un piéton ou un cycliste."

---

## Slide 2 — La Solution : Qu'est-ce que VRUGuard ?
**Objectif :** Présenter VRUGuard comme un bouclier technologique adaptable.
* **Contenu :**
  * Une plateforme SaaS multiservices convertissant le smartphone en capteur de sécurité.
  * Fusion de données hybride (Quantum / Classique) pour une précision accrue.
  * Agent IA intégré pour l'analyse de risque en temps réel.
  * Disponible sur Web, iOS et Android (via approche PWA/Capacitor).
* **Détails techniques :**
  * Architecture React + Vite + Firebase.
  * Algorithmes de minimisation de la RMSE (Root Mean Square Error).
  * Déploiement cloud avec Cloudflare Workers et Edge computing.
* **Note orateur :** "VRUGuard n'est pas qu'une carte, c'est un moteur d'analyse de risques continu. La plateforme collecte les données environnementales, les fusionne, et adapte ses interactions via Web, iOS ou Android."

---

## Slide 3 — Comment VRUGuard gère-t-il la géolocalisation précise ?
**Objectif :** Détailler le moteur de localisation.
* **Contenu :**
  * Analyse de la qualité et fusion de capteurs (GPS L1/L5, UWB, LiDAR simulé).
  * Affichage de la position brute face à la position corrigée.
  * Adaptation selon le contexte (ciel ouvert vs canyon urbain).
* **Détails techniques :**
  * Simulation d'erreurs stochastiques selon des modèles mathématiques.
  * Interface `SensorOptimizationResponse` avec Gemini pour l'ajustement dynamique.
* **Note orateur :** "La plateforme simule des environnements complexes. Si le GPS classique flanche sous la pluie, notre IA bascule sur la recommandation de capteurs alternatifs comme le radar."

---

## Slide 4 — Comment s'effectue le guidage intelligent ?
**Objectif :** Présenter les itinéraires basés sur le risque.
* **Contenu :**
  * Calcul de routes non seulement selon le temps, mais selon un **Score de Risque**.
  * Intégration en direct des alertes et incidents dans le tracé.
  * Bouton de réglage du poids (Temps vs Sécurité).
* **Détails techniques :**
  * API OpenRouteService (OSRM) pour le routage de base.
  * `RoutingService.ts` avec algorithme d'ajustement de graphe (A* / Dijkstra modifié).
* **Note orateur :** "Plutôt que le chemin le plus rapide, VRUGuard propose le chemin le plus sûr. L'algorithme dévie l'usager des zones à haute densité d'incidents."

---

## Slide 5 — Qu'apporte l'enrichissement sémantique de la carte ?
**Objectif :** Montrer l'analyse des infrastructures.
* **Contenu :**
  * Extraction des types de voies et infrastructures (passages piétons, pistes cyclables).
  * Attribution d'un niveau de risque intrinsèque à chaque zone.
* **Détails techniques :**
  * API Overpass (OpenStreetMap) pour les données vectorielles.
  * Indexation spatiale et traitement côté client (Turf.js).
* **Note orateur :** "Notre système analyse l'infrastructure elle-même grâce aux données OpenStreetMap, identifiant mathématiquement les carrefours à risques."

---

## Slide 6 — Que fait VRUGuard pour les PMR (Personnes à Mobilité Réduite) ?
**Objectif :** Mettre en avant l'accessibilité.
* **Contenu :**
  * Signalement d'obstacles spécifiquement bloquants (trottoirs non abaissés, travaux).
  * Recalcul d'itinéraires évitant les zones signalées inaccessibles.
  * Base de données collaborative d'accessibilité.
* **Détails techniques :**
  * `PmrService.ts` et `ReportPmrModal`.
  * Filtre de graphes de routage avec `GeoJSON` de pénalité élevée.
* **Note orateur :** "Un obstacle temporaire est une nuisance pour un piéton, mais un mur pour une personne en fauteuil. Ce module communautaire ajuste instantanément les routes PMR."

---

## Slide 7 — Comment fonctionne l'assistance audio et les alertes ?
**Objectif :** Interaction sans regarder l'écran (Hands-free).
* **Contenu :**
  * Guidage vocal activé par défaut.
  * Alertes sonores directionnelles et de gravité (Bip critique vs Avertissement doux).
  * Notifications visuelles claires au centre de l'écran (Live Alerts).
* **Détails techniques :**
  * Web Speech API pour la synthèse vocale (`AudioGuidanceService`).
  * Contexte audio généré à partir de `LiveInteractionService`.
* **Note orateur :** "Le guidage et les alertes audio sont essentiels pour ne pas monopoliser l'attention visuelle de l'usager, lui permettant de garder les yeux sur la route."

---

## Slide 8 — Que fournit le système d'évaluation des Zones ?
**Objectif :** Détailler la carte de chaleur dynamique.
* **Contenu :**
  * Division de l'espace en grille hexagonale ou tuiles (Heatmap).
  * Évaluation du risque basée sur l'historique et les incidents récents (0 à 100).
* **Détails techniques :**
  * Grilles d'évaluation utilisant `ngeohash`.
  * Rendu Leaflet Heatmap Layer.
* **Note orateur :** "Cette fonctionnalité affiche une carte thermique en temps réel. Elle évalue la sûreté d'une zone globale, permettant d'anticiper les secteurs historiquement dangereux."

---

## Slide 9 — Comment les incidents sont-ils signalés et partagés ?
**Objectif :** Présenter le Crowdsourcing de sécurité.
* **Contenu :**
  * Signalement rapide sur la carte (Travaux, Accident, Danger météo).
  * Disparition automatique après expiration ou invalidation.
  * Système de vote (Upvote) pour la fiabilité.
* **Détails techniques :**
  * Stockage Firestore (collection `incidents`).
  * TTL (Time To Live) sur les documents MongoDB/Firestore.
* **Note orateur :** "Grâce au signalement communautaire instantané, la carte vit et réagit. Un danger signalé par un usager modifie immédiatement les recommandations des autres."

---

## Slide 10 — À quoi sert la fonctionnalité TripRoom ?
**Objectif :** Focus sur les sessions de trajets sécurisées.
* **Contenu :**
  * Création d'une salle temporaire pour un groupe voyageant ensemble.
  * Position partagée en temps réel entre les membres de la bulle.
  * Chat rapide et partage de points d'intérêt immédiats.
* **Détails techniques :**
  * Firestore Snapshots sur un document `trip_rooms/{id}`.
  * Isolation sécurisée des coordonnées GPS.
* **Note orateur :** "Le TripRoom permet aux cyclistes d'un même convoi ou à une famille de garder un œil protecteur les uns sur les autres, avec une messagerie instantanée locale."

---

## Slide 11 — Comment le système IA de Recommandation agit-il ?
**Objectif :** L'Agent "AI Sentinel".
* **Contenu :**
  * Analyse contextuelle permanente (Météo, Jour/Nuit, Vitesse).
  * Génère un conseil tactique ciblé (ex: "Réduisez la vitesse, pluie forte").
  * Optimisation dynamique des capteurs (Quantum fusion logic).
* **Détails techniques :**
  * Call API vers le SDK **@google/genai** (Gemini 3.1 Flash).
  * Prompts systémiques et structurés au format JSON.
* **Note orateur :** "Notre IA analyse le bruit des capteurs et les conditions météo pour proposer des micro-actions préventives avant même que l'incident ne survienne."

---

## Slide 12 — Comment le système SOS a-t-il été amélioré ?
**Objectif :** Présenter l'arme ultime de sécurité.
* **Contenu :**
  * Bouton "SOS Rapide" multifonction (Police, Pompier, Assistance, Famille).
  * Exécution automatique multiscanaux (WhatsApp, SMS, Appels, Notification In-App).
  * Protection Anti-faux clic (Curseur / Appui long).
  * Check-In de sécurité (Déclenchement automatique si absence de réponse).
* **Détails techniques :**
  * `SosService.ts` avec déclencheurs asynchrones de liens (`tel:`, `sms:`, `wa.me`).
  * Sous-collections Firestore pour les journaux strictes d'audits SOS.
* **Note orateur :** "C'est l'écran le plus critique : un SOS modulable. Avec protection contre les faux appels, et intégration directe de WhatsApp ou SMS vers des contacts de confiance verrouillés."

---

## Slide 13 — Qui reçoit ces alertes SOS ? (Trusted Contacts)
**Objectif :** L'écosystème de confiance.
* **Contenu :**
  * Liste sécurisée des contacts (Plateforme internes + Numéros personnels).
  * Restriction absolue : un SOS ne part que vers ces contacts validés.
  * Gestion des priorités et modèles de messages modifiables.
* **Détails techniques :**
  * CRUD Firestore géré par le `TrustService.ts`.
  * Fusion de la liste d'amis in-app et des contacts extérieurs.
* **Note orateur :** "Les alertes d'inconnus sont ignorées, mais dès que vos Trusted Contacts sont ciblés, ils reçoivent votre position en temps réel par leur canal favori."

---

## Slide 14 — Pourquoi le système de messagerie et notifications est-il crucial ?
**Objectif :** Communication V2X et inter-utilisateurs.
* **Contenu :**
  * Standard DENM (Decentralized Environmental Notification Message) émulé.
  * Messages critiques cross-platform.
  * Bannières non-intrusives pour éviter de masquer la navigation.
* **Détails techniques :**
  * Geohashing (`ngeohash`) pour diffuser l'alerte uniquement aux voisins pertinents.
  * Architecture Firestore Realtime Listeners.
* **Note orateur :** "Les véhicules et l'infrastucture communiquent avec l'usager vulnérable via un système de notifications asynchrones, empêchant le spam mais garantissant la livraison de l'alerte."

---

## Slide 15 — Avantages pour l'Utilisateur
* **Objectif :** Résumer le bénéfice client clair.
* **Contenu :**
  * Accompagnement proactif plutôt que purement réactif.
  * Baisse de la charge mentale visuelle (Audio First).
  * Adaptabilité absolue selon la mobilité (PMR, Trottinettes, Piétons).
* **Détails techniques :**
  * Interfaces à fort contraste (mode sombre natif).
  * Temps de réaction sous les 200 millisecondes.
* **Note orateur :** "Du point de vue de l'utilisateur, VRUGuard offre la tranquillité d'esprit : il le laisse regarder devant lui pendant que la plateforme analyse son environnement."

---

## Slide 16 — Avantages Techniques de la Solution
* **Objectif :** Vendre la scalabilité et l'architecture.
* **Contenu :**
  * **Omnicanalité :** SaaS 100% Web (React) compatible Mobile (Android/iOS via PWA/Capacitor).
  * **Serverless :** Base Firebase / Cloudflare pour une scalabilité mondiale à faible coût.
  * **IA intégrée au bord (Edge AI) :** Décisions d'urgence ultra-rapides.
* **Détails techniques :**
  * Module Vite configuré pour compatibilité WebWorker/Cloudflare.
  * Firebase Security Rules Zero-Trust par composants.
* **Note orateur :** "Techniquement, nous avons un code universel déployable sur les stores Apple et Google, tout en gardant une flexibilité de mise à jour instantanée en pur SaaS."

---

## Slide 17 — Perspectives - Roadmap (Mois 1)
* **Objectif :** Plan de développement à 6 semaines.
* **Contenu :**
  * **Semaine 1 :** Finalisation profil de sécurité & Contacts d'urgence.
  * **Semaine 2 :** Déploiement complet du SOS Multi-catégories & Check-In.
  * **Semaine 3 :** Stabilisation du TripRoom et partage de trajet Live.
* **Détails techniques :**
  * Tests E2E des déclenchements Firestore et audits SOS logs.
* **Note orateur :** "Dans les 3 prochaines semaines, nous verrouillons la couche vitale d'urgence : SOS avancé et sessions de partage de voyages sécurisées."

---

## Slide 18 — Perspectives - Roadmap (Mois 2)
* **Objectif :** Plan de développement à 6 semaines (Suite).
* **Contenu :**
  * **Semaine 4 :** Scalabilité du signalement d'incidents (Crowdsourcing).
  * **Semaine 5 :** Recommandations v1 (AI Gemini pour contextes dynamiques).
  * **Semaine 6 :** Module d'apprentissage (Ajustement autonome des poids de routage basés sur le feedback).
* **Détails techniques :**
  * Déploiement du `WeightOptimizer.ts` via modèles génératifs.
* **Note orateur :** "Les 3 semaines suivantes se concentrent sur l'intelligence du système, où la carte deviendra autonome et ajustera ses chemins en fonction des retours concrets des usagers."

---

## Slide 19 — Dépendances & Atténuation des Risques
* **Objectif :** Être réaliste sur les blocages.
* **Contenu :**
  * **Risque iOS :** Background GPS tué par iOS. *Solution:* Utilisation renforcée du format Capacitor Native.
  * **Quotas API IA :** Coûts Gemini 3. *Solution:* Cache local et analyse ponctuelle (toutes les 15s).
  * **Précision GPS urbaine :** *Solution:* Filtrage Kalman hybride et recommandation audio.
* **Détails techniques :**
  * Gestion agressive du cache mémoire.
* **Note orateur :** "Bien que l'écosystème Apple soit restrictif, notre architecture hybride Capacitor nous permet d'y injecter des plugins de géolocalisation native puissants."

---

## Slide 20 — Conclusion
* **Objectif :** Terminer avec un "Call To Action" fort.
* **Contenu :**
  * Une approche préventive unique au monde, non plus concentrée sur les voitures, mais le piéton et le cycliste.
  * Prochaines étapes : Alpha Test avec des associations PMR.
  * "Découvrez le code source via le ZIP."
* **Détails techniques :**
  * Ouverture aux tests d'intégration Firebase.
* **Note orateur :** "VRUGuard redonne la priorité à la sécurité numérique terrestre de l'être humain. Le code source est prêt à être éprouvé. Merci pour votre attention."
