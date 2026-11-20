# Soutenance de Projet de Fin d'Études (PFE) / Thèse : Plateforme VRUGuard

Ce document est le support complet pour votre présentation de soutenance. Il détaille l'évolution de la plateforme VRUGuard (Vulnerable Road User Guard) depuis son concept initial jusqu'à sa version finale, avec le discours complet de l'orateur, les points clés à afficher et les recommandations visuelles pour vos diapositives.

---

## Slide 1 : Titre et Introduction

**Titre :** Conception et Développement de VRUGuard : Plateforme Multiplateforme pour la Sécurité des Usagers Vulnérables
**Points clés à afficher :**
* Projet : VRUGuard (Vulnerable Road User Guard).
* Objectif : Améliorer la sécurité des piétons, cyclistes et PMR grâce à la fusion de données, l'IA et les télécommunications (RTK/V2X).
* Déploiement : Plateforme Multiplateforme (Web, Android, iOS).
* Intervenant(e) : [Votre Nom / Prénom]

**Script orateur (Ce que vous devez dire) :**
"Bonjour à toutes et à tous, et merci aux membres du jury d'être présents. J'ai l'honneur de vous présenter aujourd'hui le travail réalisé lors de mon Projet de Fin d'Études, qui porte sur la conception et le développement de la plateforme VRUGuard. Dans un contexte où les villes deviennent de plus en plus denses, la sécurité des usagers vulnérables (piétons, cyclistes, personnes à mobilité réduite) est primordiale. L'objectif de ce projet a été de créer un véritable bouclier numérique multiplateforme, en partant d'une simple idée pour aboutir aujourd'hui à un produit technologique complet."

**Recommandation Visuelle :**
Un design épuré, logos de l'institution universitaire/entreprise, titre centré et une image d’arrière-plan subtile montrant une carte numérique en environnement urbain ou un usager avec son smartphone.

---

## Slide 2 : Contexte et problématique

**Titre :** Le Contexte et la Problématique
**Points clés à afficher :**
* **Constat :** Hausse des accidents impliquant des usagers vulnérables en milieu urbain.
* **Problème technologique :** Les systèmes de navigation classiques (GPS) manquent de précision (5 à 15 mètres d'erreur), ignorant les profils spécifiques (ex: PMR) et les conditions en temps réel.
* **Manque de communication :** Absence d'interactions V2X (Vehicle-to-Everything) pour les piétons.
* **Charge cognitive :** Les applications actuelles exigent un regard constant sur l'écran.

**Script orateur :**
"Le point de départ de ce projet repose sur un constat alarmant en matière de sécurité routière urbaine : face à une augmentation des mobilités douces, les usagers vulnérables sont surexposés aux accidents. Technologiquement, les GPS traditionnels de nos smartphones sont imprécis, particulièrement dans les canyons urbains où les signaux rebondissent, provoquant de fausses indications. De plus, ces outils ne tiennent pas compte de qui tient le téléphone : un piéton rapide n'a pas les mêmes besoins qu'une personne en fauteuil roulant. Le défi principal était de pallier ces lacunes pour prévenir les collisions avant qu'elles ne se produisent, tout en minimisant la distraction de l'usager."

**Recommandation Visuelle :**
Deux images côte à côte : d'un côté, une photo de trafic urbain dense (canyon urbain), et de l'autre, un graphique frappant ou une infographie montrant la courbe de risque pour les usagers vulnérables.

---

## Slide 3 : Objectifs du projet

**Titre :** Les Objectifs du Projet
**Points clés à afficher :**
* Créer une approche proactive (prévention) plutôt que réactive.
* Atteindre une précision de géolocalisation centimétrique (via matériel coopératif RTK/TERIA).
* Concevoir une architecture logicielle robuste, sécurisée et Cross-Platform.
* Intégrer l'intelligence artificielle pour du routage contextuel centré sur le risque.
* Préserver l'accessibilité avec une interface vocale (Hands-free).

**Script orateur :**
"Pour résoudre ces problématiques, nous avons fixé des objectifs techniques et fonctionnels stricts. Il ne s'agissait pas de recréer un Google Maps, mais de développer un outil sécuritaire proactif. L'objectif majeur était l'intégration de technologies de pointe comme le positionnement cinématique temps réel (RTK via le réseau TERIA) pour obtenir une précision au centimètre. En parallèle, nous visions la conception d'une plateforme multiplateforme accessible sur n'importe quel périphérique en combinant une fluidité d'interface absolue, une analyse algorithmique des risques en périphérie (Edge/IA), et une assistance audio pour un usage sans écran."

**Recommandation Visuelle :**
Schéma sous forme d'entonnoir (Entrées : GPS, Caméra, Capteurs ➔ VRUGuard ➔ Sortie : Navigation sécurisée) ou icônes représentant chaque objectif (Précision, Multiplateforme, IA, Accessibilité).

---

## Slide 4 : Analyse des besoins et Cas d'utilisation

**Titre :** Analyse des Besoins (Fonctionnels et Non-Fonctionnels)
**Points clés à afficher :**
* **Fonctionnels :**
  * Suivi de position extrêmement précis.
  * Création et diffusion d'alertes en temps réel.
  * Modèle de routage basé sur les risques dynamiques.
  * Partage collaboratif (SOS, TripRooms, signalements PMR).
* **Non-Fonctionnels :**
  * Disponibilité et robustesse du système (Cloud Serverless).
  * Latence minimale critique (Socket Native Dure/WebSockets).
  * Code base unique (Cross-platform).
* **Utilisateurs cibles :** Piétons, Cyclistes, PMR, Administrateurs de sécurité urbaine.

**Script orateur :**
"L'analyse approfondie des besoins a révélé une séparation stricte entre les attentes fonctionnelles et non fonctionnelles. Côté fonctionnel, le système doit suivre la position de manière quasi-parfaite, émettre des alertes instantanées vers tous les véhicules ou autres usagers alentour, et proposer un moteur de calcul d'itinéraire centré non pas sur la vitesse, mais sur le risque. Mais le plus grand défi résidait dans les exigences non fonctionnelles : en cas de danger, on ne peut pas tolérer le délai de rechargement d'une page ; la latence doit être infime. Et bien sûr, tout ceci devait être codé de façon à cibler à la fois le Web, iOS et Android pour minimiser le time-to-market et la maintenance."

**Recommandation Visuelle :**
Diagramme des cas d'utilisation (UML) stylisé : acteurs (PMR, Cycliste, Admin) connectés aux briques de cas d'utilisation ('Calculer un itinéraire', 'Déclencher un incident', 'Mode Coopératif').

---

## Slide 5 : Conception de la solution (Architecture)

**Titre :** Conception et Choix Technologiques
**Points clés à afficher :**
* **Frontend :** React 18, Vite, Tailwind CSS (Performances et modularité UI).
* **Backend Backend-as-a-Service :** Firebase (Firestore temps réel, Auth).
* **Mobilité (Cross-platform) :** Capacitor (Pont direct vers API natives iOS/Android, WebSockets natifs).
* **Cartographie :** Leaflet (Léger, Canvas optimisé pour des centaines de marqueurs).
* **Matériel coopératif :** Réseau TERIA pour les corrections géospatiales.

**Script orateur :**
"Sur le plan architectural, nous avons adopté une méthodologie moderne basant notre logique sur une base de code partagée. Le Frontend est motorisé par React pour ses capacités de rendu rapide induites par le DOM virtuel, lié à Vite pour une compilation instantanée. Côté Backend, plutôt que de reconstruire un service monolithique, nous avons tiré parti de Firebase Firestore pour bénéficier de bases de données NoSQL se synchronisant en temps réel via WebSockets, une nécessité pour l'affichage des alertes et véhicules. Pour transformer ce code Web en applications mobiles natives sans sacrifier les performances du réseau, Capacitor a été choisi. Enfin, le moteur Leaflet gère le rendu lourd des cartes, adapté aux vues vectorielles complexes."

**Recommandation Visuelle :**
Diagramme d'Architecture (React Frontend ➔ Capacitor Bridge / Web Socket ➔ Firebase Cloud/API REST externes ➔ Matériel TERIA GPS/GNSS) avec les logos officiels des technologies.

---

## Slide 6 : Évolution - Version 0 (Genèse et Prototypes)

**Titre :** Évolution : Version 0 (Le Prototype Initiale)
**Points clés à afficher :**
* **Fonctionnalités intégrées :**
  * Affichage d'une carte numérique interactive (Leaflet).
  * Système de géolocalisation basique via l'API HTML5 du navigateur.
  * Création de la maquette "Point Bleu" (suivi de position standard).
  * Structure de base de l'interface Web (Interface UI).
* **Objectif initial :** Valider l'affichage de l'utilisateur sur une carte réactive.
* **Leçon apprise :** L'API web GPS standard est imprécise (sauts de position, "drift" urbain). Le Web seul ne suffit pas pour de la sécurité vitale.

**Script orateur :**
"Entrons dans la chronologie de développement du projet avec la Version 0. L'objectif était de poser les fondations architecturales. Sur cette version, les fonctionnalités développées étaient très primaires : le chargement du moteur cartographique Leaflet, la connexion avec l'API de géolocalisation du navigateur, et l'affichage de l'utilisateur sous forme d'un marqueur bleu. Cependant, ce test grandeur nature nous a frappés : l'API web standard souffrait d'une instabilité massive en ville avec des sauts de localisation. Cela a instantanément validé notre hypothèse : pour la vraie sécurité, il nous faudra interfacer du matériel GNSS de haute qualité."

**Recommandation Visuelle :**
Capture d'écran du tout premier prototype basique : une carte avec un marqueur bleu accompagné d'une zone d'incertitude très large (cercle gris clair) illustrant l'erreur GPS.

---

## Slide 7 : Évolution - Version 1 (Temps Réel et Cloud)

**Titre :** Évolution : Version 1 (Architecture Réactive & Signalements)
**Points clés à afficher :**
* **Fonctionnalités intégrées :**
  * Authentification des utilisateurs et configuration backend (Firebase Cloud).
  * Outil de signalement participatif (déclarer des travaux, des nids-de-poule, des accidents).
  * Simulateur métier (injection de piétons/véhicules virtuels pour tester la capacité de l'outil).
  * Switch de calques cartographiques (Sombres, Satellite, Zones de friction).
  * Algorithmes locaux de maillage (Heatmap de densité).
* **Défis :** Surcharges de rendus sur React avec de nombreux éléments (chute des FPS).
* **Solution :** Utilisation du rendu matériel `Canvas` pour Leaflet (dessin graphique plutôt que DOM DOM Element).

**Script orateur :**
"La Version 1 marque le passage au temps réel. Nous avons ajouté un large panel de fonctionnalités : la gestion des comptes sécurisés sur Firebase, et surtout le système de signalement collaboratif, où un utilisateur peut marquer un danger sur la carte pour tous les autres. Pour valider l'impact sans risques réels, nous avons codé un simulateur de trafic complet générant des 'agents virtuels'. Face à cet afflux de données, l'interface graphique a commencé à saturer. La solution fut technique : nous avons désactivé le rendu classique du navigateur (SVG) pour toutes nos cartes et forcé l'utilisation du Canvas HTML5, accélérant l'affichage pour supporter des centaines de marqueurs sans aucune chute de fluidité."

**Recommandation Visuelle :**
Capture de l'interface montrant les outils de signalements en surbrillance, et l'affichage via différents "layers" et marqueurs d'incidents sur une carte sombre urbaine.

---

## Slide 8 : Évolution - Version 2 (Le Tournant Matériel RTK)

**Titre :** Évolution : Version 2 (Matériel Coopératif, Précision & UX)
**Points clés à afficher :**
* **Fonctionnalités intégrées :**
  * Plugin d'interfaçage RTK/TERIA par WebSockets Natifs ou TCP.
  * Parser algorithmique des trames satellitaires NMEA ($GPGGA, $GPRMC).
  * Mode Compas : Rotation fluide de la carte alignée avec la direction (Heading-Up).
  * "Dynamic Auto-Zoom" : Zoom intelligent s'ajustant automatiquement selon la vitesse et la proximité des incidents.
  * Filtre qualitatif GPS (rejet automatique des coordonnées non fiables).
* **Défis v2 :** Politiques de sécurité (Mixed-Content) bloquant la connexion à du matériel IP local via HTTPS cloud.
* **Solution :** Développement d'un pont Capacitor hybride pour la version compilée mobile.

**Script orateur :**
"La Version 2 a été la plus déterminante : l'introduction du capteur coopératif de précision centimétrique (Réseau Teria). Nous avons ajouté des fonctionnalités cruciales liées au matériel : le parsing brut en temps réel des trames NMEA, un mode 'Compass' qui tourne la carte en fonction du cap de navigation à la manière d'un vrai GPS embarqué, et un mécanisme de Zoom Dynamique qui s'élargit ou se resserre en fonction de votre vitesse. La difficulté principale a résidé dans la connexion : le navigateur cloud interdisait l'interfaçage HTTP vers l'antenne locale. Nous avons donc dû coder des ponts 'WebSockets natifs' et un plugin 'Capacitor', ouvrant la voie à une version compilée en application iOS/Android totalement sans friction réseau."

**Recommandation Visuelle :**
Schéma montrant l'application VRUGuard qui lit les trames `$GPGGA` d'une antenne externe. Image comparant le mode cartographie standard "Nord en haut" vs "Cap en haut" (Compass mode).

---

## Slide 9 : Évolution - Versions Intermédiaires (Collaboratif & Paramédical)

**Titre :** Évolution : Versions Sécurité Avancée et Logique IA
**Points clés à afficher :**
* **Fonctionnalités intégrées :**
  * "SOS Mode" (Déclenchement central avec mécanique "long-press" anti-erreur).
  * TripRooms : Création de sessions de voyages sécurisées entre proches (codes PIN).
  * Module PMR (Personnes à Mobilité Réduite) : Recalcul de routes selon les signalements de pentes/trottoirs infranchissables.
  * Module "Text-to-Speech" (Guidage audio) et d'alertes "hands-free" pour marcher sans regarder l'écran.
  * Moteur local de modélisation de risques V2X géozonés.

**Script orateur :**
"Une fois le signal de la localisation purifié, nous avons implémenté l'essence même de l'outil : les blocs de sécurité applicative. Nous avons lancé la mécanique 'TripRooms', permettant à un groupe ou une famille de partager une session géographique verrouillée, et associé à cela un bouton 'SOS' sécurisé contournant les blocages OS pour alerter tous les contacts de confiance. Sur le plan civique, un module PMR est né : l'outil adapte la route spécifiquement pour les fauteuils roulants en évitant les trottoirs non-abaissés. Et pour assurer que la prévention routière ne vienne pas s'ajouter à la distraction visuelle (ne pas regarder son téléphone en marchant), nous avons codé un système d’alertes sonores 'Hands-Free' qui synthétise la voix en direct."

**Recommandation Visuelle :**
Un triptyque visuel avec le bouton SOS maintenu enfoncé (avec sa jauge circulaire de long-press), l'interface d'injonction TripRoom, et un signalement de type 'Trottoir non franchissable'.

---

## Slide 10 : Évolution - La Version Finale Déployée

**Titre :** La Version Finale (Déploiement SaaS, PWA et Intelligence IA)
**Points clés à afficher :**
* **Fonctionnalités intégrées :**
  * Sentinelle IA (Branchement avec Google Gemini) : analyse sémantique et contextuelle du risque environnemental (météo + densité + horaire).
  * Bifurcation totale Cross-Platform (Compilation d'un .APK natif Android et Web app).
  * Dashboards Utilisateurs : Visualisation de l'historique des trajets et profil.
  * Outils de debug administrateur cachés (Logs, feedbacks utilisateurs).
  * Mode silencieux global (Silence Mode).
* **Paré pour la production :** Intégration continue, linter, refactorisation complète du code.

**Script orateur :**
"Enfin, nous aboutissons à la version finale, prête au déploiement en production, que vous pouvez consulter à la démonstration. Les dernières fonctionnalités majeures incluaient l'intégration d'une dimension d'Intelligence Artificielle. Un module 'Sentinelle', communiquant avec le LLM Gemini, permet de déduire des niveaux de risques composites non évidents (par exemple, la combinaison de la pluie, de 18h un vendredi, et d'un match de foot proche déclenche des micro-zones rouges sans même l'intervention humaine). L'application a été dotée de ses profils utilisateurs complets, du mode analytique historique, et s'emballe désormais dans un paquet binaire natif propre (Cross-Platform) qui fonctionne tout aussi bien en PWA Web sur le Cloud qu'en application téléchargée localement."

**Recommandation Visuelle :**
Capture de l'écran principal affichant la Pop-up analytique de l'IA "Sentinelle" (évaluation des risques textuelle ou synthétique) et les logs systèmes, montrant qu'il s'agit d'un produit complexe et achevé.

---

## Slide 11 : Le Développement Technique (Sous le Capot)

**Titre :** Vue d'ensemble du Développement Technique
**Points clés à afficher :**
* **Langage Principal :** TypeScript / Strict Type-safety.
* **Modèle d'État (React) :** Custom Hooks (`useTeria`, `useMapEvents`) limitant le couplage.
* **Traitement des Trames (NMEA) :** Parsing algorithmique des longitudes/latitudes directionnelles pour éviter les calculs coûteux du moteur physique spatial.
* **Réseau :** Remplacement stratégique du HTTP traditionnel par WebSocket Natif (`ws://`) pour pallier les ralentissements de 'polling'.

**Script orateur :**
"Pour lever un peu le capot technique du projet, tout a été développé en TypeScript strict, crucial pour un projet où les données de coordonnées spatiales, si mal typées, peuvent induire des bugs désastreux. La gestion d'état s'appuie sur la découpe granulaire en Custom Hooks React, par exemple notre module de parsing NMEA. Un détail technique intéressant : pour réduire la latence réseau entre notre matériel et le logiciel, nous avons abandonné la méthode de 'polling' classique au profit de WeSockets bidirectionnels natifs. Cette décision a fait fondre le temps de rafraîchissement positionnel de 1.5 seconde à quelques millisecondes."

**Recommandation Visuelle :**
Un petit fragment de code affichant le typage propre d'une trame GPS associée au `useEffect` optimisé de React pour les WebSockets.

---

## Slide 12 : Défis majeurs et Résolutions

**Titre :** Défis Technologiques et Solutions
**Points clés à afficher :**
* **Défi 1 :** Mixed-Content HTTP/HTTPS sur Cloud et réseau local.
  * *Solution :* Ponts de requêtes (Proxy) et création d'une option de mode natif "Direct WebSockets" côté réseau local.
* **Défi 2 :** Render Blocking du navigateur à cause des lourds calculs de géométrie Leaflet.
  * *Solution :* Désactivation massive de SVG, switch total sur rendu CANVAS HTML5 2D matériel.
* **Défi 3 :** Limitations Background OS (iOS tue le GPS).
  * *Solution :* Exécution d'agents persistants via configuration Native Android/iOS.

**Script orateur :**
"Aucun projet ambitieux ne se fait sans embûches. Le principal point dur de la conception a incontestablement résidé dans les protocoles de sécurité réseau. Rendre une application cloud hybride capable de communiquer intimement avec une puce matérielle sous la même adresse WiFi sans se faire bloquer par les verrous de sécurité a nécessité l'ingénierie du sous-mode de connexion 'Direct WebSockets'. Second défi : les performances cartographiques. L'affichage SVG classique des cartes tuait les batteries de smartphones et faisait ralentir l'application. La migration et réécriture totale des calques en HTML5 Canvas avec accélération matérielle a permis de multiplier la fluidité par 5."

**Recommandation Visuelle :**
Tableau comparatif clair : "Problème" vs "Solution Technique".

---

## Slide 13 : Résultats obtenus et Performances

**Titre :** Résultats de la Plateforme Finale
**Points clés à afficher :**
* **Précision :** Passage de ~8 m d'erreur (Smartphone natif) à < 1 m avec Couplage Coopératif (TERIA).
* **Parité fonctionnelle :** 98% des fonctionnalités identiques entre Web, iOS et Android (Zero duplication de code fonctionnel).
* **Performance :** L'UI maintient 60 fps constants même avec plus de 200 agents visuels (Simulation Mode).
* **Sécurité :** Déclenchement de la chaine SOS vers Firebase achevée en ~120 millisecondes.

**Script orateur :**
"En mesurant les livrables face aux objectifs, les résultats sont concluants. En matière de précision d'orientation, lorsque notre mode TCP matériel est connecté, l'écart sur la carte Leaflet passe de 10 mètres à moins d'un mètre, une granularité vitale pour valider le franchissement d'un trottoir par une personne PMR. Grâce au travail accompli sur le socle Capacitor, nous avons atteint une parité de code presque parfaite : un seul code base, trois plateformes différentes. Les contraintes temps-réel ont été battues, les requêtes de SOS critiques mettent moins d'un dixième de seconde à se lier aux pare-feux de la base de données."

**Recommandation Visuelle :**
Graphique à barres ou histogramme montrant la réduction de la latence, et le gain de précision en mètres (avant/après). 

---

## Slide 14 : Démonstration de la Plateforme

**Titre :** Démonstration de VRUGuard
**Points clés à afficher :**
(Idéalement, cette slide contient une vidéo embarquée ou vous basculez vers le navigateur Web.)
* Connexion au tableau de bord.
* Démonstration du signalement instantané d'un incident.
* Activation de l'alerte d'environnement "SOS" in-app.
* Basculement sur le paramétrage Matériel Coopératif (Teria).

**Script orateur :**
"Plutôt que des schémas, je vous invite maintenant à observer rapidement la manipulation de la plateforme en temps réel. [Dérouler la vidéo ou la démo live]. Comme vous le voyez, je me connecte. La carte charge instantanément les risques dynamiques. Si je signale un point de travaux, il apparaît en direct. En ouvrant le panel SOS, un long-press évite les clics fantômes, et enfin, l'accès au module de paramétrage réseau permet au technicien routier de renseigner l'IP matérielle pour basculer en haute précision."

**Recommandation Visuelle :**
Un GIF dynamique de quelques secondes, ou un lien direct pour effectuer votre présentation live.

---

## Slide 15 : Conclusion et Perspectives

**Titre :** Conclusion et Perspectives d'Avenir
**Points clés à afficher :**
* **Bilan :** Preuve que la fusion du matériel (RTK) et des frameworks Web temps réel offre une solution fiable de sécurité publique.
* **Apports académiques/professionnels :** Compréhension des limites navigateurs et optimisation de WebSockets et géométrie Canvas spatiales.
* **Limites actuelles :** Dépendance au signal réseau stable pour Firestore.
* **Perspectives futures :** Intégration Native 5G C-V2X (antennes RSUs) directement pour l'échange inter-véhicules. Exportation vers le système Automobile (CarPlay/Android Auto).

**Script orateur :**
"Pour conclure, ce projet a prouvé la viabilité d'un bouclier numérique logiciel universel, pouvant fusionner harmonieusement avec des antennes GPS de pointe pour assurer la sécurité de chacun. Au travers de ces développements, l'expertise dégagée sur l'optimisation des navigateurs cartographiques, la sécurité des WebSockets, et la résilience Serverless de Firebase forme un socle technique solide. Néanmoins des limites demeurent, notamment une dépendance aux zones sans réseaux 4G/5G causant une cécité momentanée du cloud. Pour l'avenir, la prochaine suite logique sera de certifier la communication de notre outil directement vers l'OBU (On-Board Unit) natif des véhicules routiers protocoles stricts C-V2X ou le déploiement sur Android Auto.
Je vous remercie sincèrement de m'avoir écouté et me tiens prêt à répondre à vos questions."

**Recommandation Visuelle :**
Un visuel symbolisant le futur (par exemple une intersection routière intelligente connectée), remerciements en bas, "Code complet et sources accessibles."
