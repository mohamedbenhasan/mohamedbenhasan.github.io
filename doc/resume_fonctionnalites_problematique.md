# Problématique et Résumé Exhaustif des Fonctionnalités : Plateforme VRUGuard

Ce document synthétise la valeur académique et applicative du projet VRUGuard. Il est conçu pour être intégré dans l'introduction (problématique) et le corpus analytique (fonctionnalités) d'un rapport de Projet de Fin d'Études ou d'une Thèse. Il fait l'inventaire de l'ensemble des modules développés dans la plateforme.

---

## 1. La Problématique : Les limites du marché et la proposition de valeur VRUGuard

**Constat général :** 
L'émergence des nouvelles mobilités urbaines douces a drastiquement augmenté l'exposition des Usagers Vulnérables de la Route (VRU : piétons, cyclistes, PMR). Si les systèmes de transport intelligents (ITS) ont fortement bénéficié aux automobiles, les outils de navigation grand public actuellement sur le marché (tels que Google Maps, Waze ou Apple Plans) présentent de sévères lacunes lorsqu'il s'agit d'assurer la sécurité vitale de ces usagers non protégés. 

Notre plateforme multiplateforme résout précisément les problèmes critiques suivants :

1.  **L'illusion de "l'usager standard" (Le manque de profilage personnalisé) :**
    *   *Problème actuel :* Les applications actuelles calculent des itinéraires en considérant un "piéton" comme une entité générique. Un jeune athlète, une personne malvoyante, ou un citoyen en fauteuil roulant se voient proposer le même chemin, menant parfois à des situations de blocage ou de grave danger (absence de bateaux de trottoir, pentes abruptes, escaliers non répertoriés).
    *   *Solution VRUGuard :* Le système introduit un **profilage personnalisé profond**. Le calcul algorithmique des risques et des itinéraires est dynamiquement pondéré selon les capacités physiques et le mode de déplacement déclaré de l'usager, garantissant une route virtuellement "sécurisée sur-mesure".
2.  **L'imprécision mortelle de la géolocalisation grand public :**
    *   *Problème actuel :* Le GPS d'un smartphone standard présente une erreur de 5 à 15 mètres, spécialement en environnement urbain complexe ("effet canyon"). Sur une route, 5 mètres équivalent à une voie de circulation entière : le système ne sait pas si l'usager est sur le trottoir ou au milieu du carrefour.
    *   *Solution VRUGuard :* L'hybridation avec des équipements coopératifs (Réseau de correction RTK/TERIA) offrant une précision centimétrique, primordiale pour valider les interactions de proximité critique (V2X).
3.  **La distraction numérique et l'effet "Smombie" :**
    *   *Problème actuel :* Les applications de navigation forcent l'usager à regarder son écran pour interagir ou obtenir des alertes, réduisant sa conscience situationnelle (le rendant "smartphone zombie").
    *   *Solution VRUGuard :* Des modules de Contrôle Vocal complet et des alertes Audio prédictives fonctionnant en arrière-plan, libérant le regard de l'usager.
4.  **L'absence d'analyse matricielle des risques en temps réel :**
    *   *Problème actuel :* Les cartes actuelles sont statiques vis-à-vis du danger.
    *   *Solution VRUGuard :* L'intégration d'une plateforme communautaire couplée à une Intelligence Artificielle (Sentinelle) qui croise en temps réel la topologie, la météo, la sécurité, et le comportement des VRU pour déduire des risques préventifs locaux.

---

## 2. Inventaire Exhaustif des Fonctionnalités de la Plateforme

L'application VRUGuard dépasse la simple carte numérique pour devenir un véritable écosystème de sécurité. Voici la description conceptuelle de l'ensemble de ses fonctionnalités :

### A. Télémétrie, Précision et Cartographie Intelligente
*   **Interfaçage Matériel GNSS/RTK (Mode TERIA) :** Un sous-système de communication réseau de bas niveau (WebSockets Natifs et protocoles TCP) permettant de connecter l'application logicielle avec des antennes GPS professionnelles. Ce module extrait et parse les trames NMEA pour offrir un positionnement de haute criticité.
*   **"Compass Mode" et Zoom Dynamique :** Une fonctionnalité cartographique qui pivote la carte pour s'aligner continuellement sur le champ de vision ou la direction cinématique de l'utilisateur (Heading-Up), couplée à un zoom s'ajustant algorithmiquement à la vitesse de déplacement de l'usager.
*   **Moteur Cartographique à Hautes Performances (Canvas) :** L'usage d'une technologie d'accélération matérielle (WebGL/Canvas) permettant de superposer un volume massif de données (Heatmaps, centaines d'agents) sans paralyser le taux de rafraîchissement des appareils mobiles.
*   **Algorithme de "Map Matching" :** Traitement des signaux de géolocalisation locaux pour recadrer la position brute de l'usager sur la topologie pertinente du réseau routier et des trottoirs.

### B. Interfaces Sensorielles Accessibles (Hands-Free)
*   **Contrôle Vocal Interactif (Interface sans Écran) :** Un module de reconnaissance vocale qui capte et interprète des commandes à la volée. L'utilisateur peut vocalement déclencher un SOS, interroger le système sur l'itinéraire, ou signaler un obstacle sans déverrouiller physiquement son écran.
*   **Guidage Audio Proactif (Text-to-Speech) :** Un mécanisme de prévention verbale. Le système analyse les dangers imminents sur la trajectoire projective du VRU (ex : travaux dans 50m, forte pente) et les énonce avec précision, garantissant un maintien de l'attention environnementale.

### C. Réseaux de Soins et Partage Sécurisé (Care Networks)
*   **Suivi Parental (Parental Tracking & Geofencing) :** Une mécanique visant la sécurité familiale. Permet de tracer le parcours scolaire des plus jeunes, configuré avec des barrières géographiques intelligentes (Geofences) qui notifient silencieusement les parents si un périmètre approuvé est franchi ou quitté.
*   **Suivi par un Tiers de Confiance (Trust Service) :** Un système de délégation d'escorte digitale. Pour un déplacement de nuit ou en zone sensible, l'usager peut déléguer momentanément les clés de lecture de sa géolocalisation fine en temps réel vers un accompagnateur tiers qualifié.
*   **"TripRooms" (Sessions de Déplacements Synchronisées) :** La création de salons logistiques sécurisés par des codes cryptographiques (PIN) permettant à un groupe d'individus de monitorer mutuellement leurs positions sur un seul panneau focalisé, très utilisé en manifestations ou trajets croisés.

### D. Outils Collaboratifs et Crowdsourcing
*   **Déclaration d'Incidents en Temps Réel sur la Carte :** Un outil d'engagement civique où d'un simple geste (ou voix), l'utilisateur pointe et classifie un danger spatial (nids-de-poule extrêmes, véhicule couché, travaux non balisés), propageant la topographie de l'incident instantanément vers tous les appareils du réseau de la ville.
*   **Module Spécifique PMR (Personnes à Mobilité Réduite) :** Un protocole qui gère le cycle de vie du danger pour les fauteuils (trottoirs non abaissés, escaliers masqués). Dès la signalisation du point de conflit, le graphe de calcul routier est sectionné empêchant les autres PMR d'y être acheminés.
*   **Intégration et Traitement Météorologique :** Une ingestion algorithmique des conditions climatiques pour recalculer les indices de friction statiques (ajouter un poids additionnel au danger d'un secteur par jour de pluie intense).

### E. Intelligence Artificielle et Analyse Contextuelle
*   **Sentinelle IA (Modèle Analytique Assisté par LLM Gemini) :** Une entité algorithmique d'IA contextuelle qui "réfléchit". Elle compile le profil de l'usager, les conditions météorologiques du moment, la zone géographique, et produit des déductions sémantiques ou des alertes d'environnements complexes à appréhender humainement.
*   **Moteur de Matrice des Risques Multidimensionnels :** Les formules mathématiques sous-jacentes qui évaluent dynamiquement le risque et le projettent sur l'interface globale sous forme de "Cartographies Thermiques" (Heatmap de la peur et du danger) facilement interprétables.
*   **Simulateur Métier de Stress-Test (Mode Simulation) :** Un socle permettant la génération et l'injection d'avatars de trafic virtuels dans le système global. Indispensable pour réaliser des modélisations de foules pour les concepteurs sécurité administratifs.

### F. Communication V2X et Gestion des Urgences
*   **Bouton SOS d'Urgence Sécurisé :** Un contrôleur d'alerte critique codé pour prévenir les faux positifs (Swipes / Pressions Longues) transmettant instantanément le vecteur de position de l'usager aux intervenants ou à son périmètre de confiance.
*   **Système V2X et Interfaçage d'Infrastructures (Potentiel ITS) :** Déploiement logiciel de canaux capables de lire ou communiquer des variables d'états d'infrastructures connectées environnantes (Feux de circulations intelligents, signaux I2X).
*   **Génération de Rapports Décisionnels / Historique :** Un analyseur post-événementiel permettant le diagnostic d'un parcours afin de dresser une éducation préventive ("zones de stress traversées", "dangers croisés") et la configuration d'un retour d'expérience structuré (Feedback Service).
*   **Interface de Communication Interne Chat & Presence :** Un réseau de messagerie embarqué, essentiel pour les échanges lors du maintien d'une escorte tierce ou dans les couloirs TripRooms.
*   **Mode Silencieux Global (Silence Mode) :** Fonction pour murer électroniquement la télémétrie de l'usager lors de l'entrée dans des foyers ou zones de sérénité (garantissant respect à la vie privée par limitation de données redondantes).
