# Chapitre : État de l'Art et Analyse de l'Existant

---

## 1. Introduction : Contexte Scientifique et Taxonomie des VRU

L'essor rapide des mobilités douces et la requalification de l'espace urbain ont profondément modifié la dynamique des transports routiers au cours de la dernière décennie. Au cœur de cette transition se trouvent les **Usagers Vulnérables de la Route** (en anglais **VRU : Vulnerable Road Users**), une catégorie d'usagers définie par l'absence de protection corporelle externe face aux forces d'impact d'une collision routière. Selon les directives européennes et les standards des Systèmes de Transport Intelligents (ITS), les VRU englobent principalement :
*   **Les piétons et les coureurs ;**
*   **Les cyclistes et les utilisateurs d'engins de déplacement personnel motorisés (EDPM : trottinettes, gyroroues) ;**
*   **Les Personnes à Mobilité Réduite (PMR) :** utilisateurs de fauteuils roulants, personnes âgées, personnes malvoyantes ou accompagnées d'enfants ;
*   **Les usagers à risque psychologique ou attentionnel :** enfants sur le chemin scolaire, travailleurs sur chaussée (BTP, éboueurs, coursiers).

Historiquement, le développement des **Systèmes de Transport Intelligents (ITS)** s'est focalisé sur l'optimisation des flux véhiculaires et la sécurité active des automobiles (systèmes ADAS, freinage autonome d'urgence, maintien dans la voie). Or, la protection active des VRU représente un défi scientifique et technique majeur qui ne peut être résolu par les simples paradigmes automobiles, en raison de l'imprévisibilité de leurs trajectoires, de leur hétérogénéité physique et de leur grande sensibilité à la micro-topologie urbaine (trottoirs, passages piétons, pentes, obstacles).

---

## 2. Géolocalisation et Cartographie en Milieu Urbain

### 2.1. Le GNSS Grand Public et le Défi des Canyons Urbains
La pierre angulaire de toute application de navigation repose sur les systèmes de géolocalisation par satellite (**GNSS** : GPS, Galileo, GLONASS). Sur les smartphones grand public (équipés de puces mono-fréquence L1), la précision nominale en ciel ouvert oscille entre **3 et 5 mètres**.
Cependant, en environnement intra-urbain dense, cette précision se dégrade drastiquement pour atteindre **5 à 15 mètres**, voire plus, en raison de deux phénomènes physiques critiques :
1.  **L'atténuation du signal et le masquage satellite :** Les bâtiments élevés réduisent le nombre de satellites en ligne de vue directe (*Line of Sight* - LoS), augmentant le facteur de dilution de la précision géométrique (**DOP** : *Dilution of Precision*).
2.  **L'effet de trajets multiples (*Multipath*) :** Les signaux électromagnétiques rebondissent sur les façades vitrées et les structures métalliques avant d'atteindre le récepteur du smartphone. Le calcul du temps de vol du signal étant faussé, le récepteur calcule une position erronée.

Sur le plan de la sécurité vitale des VRU, une erreur de 5 mètres est critique : **elle équivaut à la largeur d'une voie de circulation entière**. Un système classique est donc incapable de déterminer avec certitude si un piéton se trouve en sécurité sur le trottoir, engagé sur un passage piéton ou sur la chaussée au milieu du trafic routier.

### 2.2. Les Technologies de Précision Centimétrique : RTK et Réseaux Coopératifs
Pour pallier les limites du GNSS conventionnel, l'état de l'art s'oriente vers des techniques de positionnement cinématique temps réel (**RTK : *Real-Time Kinematic***) et l'hybridation des capteurs :
*   **Le principe du RTK :** Le RTK utilise les mesures de phase de la porteuse du signal satellite, comparées entre un récepteur mobile (Rover) et un réseau de stations de référence fixes dont les coordonnées géodésiques sont connues avec une exactitude absolue. Les stations calculent les erreurs différentielles (ionosphériques, troposphériques et d'horloge) et transmettent des corrections en temps réel (protocole **NTRIP / RTCM**).
*   **Les réseaux d'infrastructure (ex: Réseau TERIA en France) :** En exploitant un maillage d'antennes géodésiques professionnelles, ces réseaux permettent aux récepteurs compatibles d'atteindre une précision **centimétrique (< 2 cm)** en planimétrie et en altimétrie.
*   **Le protocole NMEA 0183 :** La communication standardisée entre les récepteurs GNSS/RTK et les calculateurs logiciels s'effectue via l'analyse sémantique de trames textuelles en série (NMEA). Les trames les plus significatives pour l'analyse des risques sont :
    *   `$GPGGA` (*Global Positioning System Fix Data*) : fournit la position spatiale 3D, l'altimétrie précise et, fondamentalement, le **facteur de qualité du Fix** (Fix Quality = 4 ou 5 pour un fix RTK entier/flottant).
    *   `$GPRMC` (*Recommended Minimum Specific GNSS Data*) : délivre le vecteur vitesse au sol et l'azimut cinématique (*Heading/Course Over Ground*).

### 2.3. Les Algorithmes de Map-Matching (Recadrage Topologique)
Même avec un positionnement amélioré, le bruit résiduel des capteurs nécessite un post-traitement algorithmique pour associer la coordonnée brute à l'élément topologique réel du réseau routier ou piétonnier : c'est le **Map-Matching**. Les approches dans la littérature se divisent en trois classes :
1.  **Géométrique (Point-to-Curve / Curve-to-Curve) :** Projection orthogonale simple de la coordonnée sur le segment de graphe le plus proche. Cette méthode échoue lors des intersections complexes.
2.  **Topologique (Plus court chemin - Dijkstra / A*) :** Intègre la connectivité du graphe routier, le sens de circulation et la continuité physique de la trajectoire du mobile.
3.  **Probabiliste (Chaînes de Markov Cachées - HMM) :** L'approche la plus robuste (fondée par Newson & Krumm). Elle modélise les segments de route comme des états cachés et les positions GPS comme des observations. Elle calcule la probabilité de transition entre segments en fonction de la distance géodésique et du vecteur vitesse, garantissant une projection fiable même en cas de perte de signal temporaire.

---

## 3. Communication V2X / C-ITS et Cartographie Collaborative

### 3.1. Le Paradigme V2X (Vehicle-to-Everything) et V2P (Vehicle-to-Pedestrian)
Les Systèmes de Transport Intelligents Coopératifs (**C-ITS**) reposent sur l'échange sans fil d'informations entre les véhicules (**V2V**), les infrastructures (**V2I**) et les piétons (**V2P**). Deux technologies radio se partagent le spectre des 5.9 GHz dans l'état de l'art industriel :
*   **DSRC (Dedicated Short-Range Communications / IEEE 802.11p) :** Dérivé du Wi-Fi, offrant une latence très faible (< 10 ms) pour les communications directes à courte portée sans infrastructure réseau, mais souffrant d'une portée limitée en milieu urbain dense.
*   **C-V2X (Cellular V2X - 3GPP LTE-V2X / 5G NR-V2X) :** Exploite les réseaux cellulaires pour des communications directes (*Sidelink* PC5) ou via le réseau (Uu). La 5G apporte un tranchage réseau (*Network Slicing*) et une informatique en périphérie de réseau (**MEC : *Multi-access Edge Computing***), permettant d'atteindre des latences compatibles avec la sécurité critique et de diffuser des alertes anticollision à grande échelle.

Dans le cas spécifique du **V2P**, le défi majeur réside dans l'asymétrie matérielle : là où un véhicule dispose d'une alimentation continue et d'antennes à fort gain, le VRU dépend d'un smartphone contraint en énergie, en puissance de calcul et en bande passante réseau.

### 3.2. Crowdsourcing et Cartographie Participative
L'enrichissement des données géospatiales par la communauté (**Crowdsourcing** ou production participative) a été popularisé par des plateformes telles qu'**OpenStreetMap (OSM)** pour la cartographie statique et **Waze** pour le trafic dynamique.
Dans le contexte de la sécurité des mobilités douces, l'état de l'art montre que :
*   Les bases de données institutionnelles (SIG municipaux) sont souvent incomplètes concernant la micro-topologie piétonne (état des revêtements, travaux éphémères, éclairage défectueux, trottoirs encombrés ou non abaissés).
*   Le signalement citoyen temps réel permet de combler ce vide décisionnel via des architectures **Pub/Sub (Publish-Subscribe)** gérées par des bases de données orientées documents (ex: NoSQL temps réel) ou des courtiers de messages (MQTT, WebSockets), propageant l'information aux agents géographiquement concernés en quelques millisecondes.

---

## 4. Intelligence Artificielle et Modélisation Prédictive des Risques

### 4.1. Du Calcul Analytique aux Cartographies Thermiques (Heatmaps)
La modélisation mathématique du risque routier ne se limite plus au simple calcul du temps avant collision (**TTC : *Time-To-Collision***) fondé sur des trajectoires linéaires rectilignes. Les modèles stochastiques modernes intègrent :
*   **Les matrices de risques multidimensionnelles :** Évaluation stochastique combinant la vitesse relative, l'angle d'intersection, la visibilité géométrique (angles morts urbains) et la densité des flux.
*   **La théorie des champs de potentiels artificiels (*Artificial Potential Fields*) :** Chaque obstacle ou véhicule émet une "force de répulsion" virtuelle (un champ de risque logarithmique ou gaussien), tandis que l'objectif émet une force d'attraction. La superposition de ces champs sur une carte génère une **matrice thermique de risque (Heatmap)**, permettant de visualiser instantanément les zones de friction et de dangerosité urbaine.

### 4.2. L'Apport des LLM et de l'IA Contextuelle en Périphérie (Edge/Cloud)
L'émergence des **Grands Modèles de Langage (LLM)** et des architectures d'IA multimodales (ex: modèles Transformer, Google Gemini) ouvre une nouvelle ère pour les ITS : l'**incursion de l'IA contextuelle et sémantique**.
Contrairement aux algorithmes de machine learning classiques (SVM, Random Forests) formés sur des variables numériques rigides, un modèle de fondation peut :
*   **Raisonner sur des contextes composites non linéaires :** Déduire un niveau de risque exceptionnel en croisant des données textuelles, météorologiques et temporelles disparates (ex: *« Pluie battante + Vendredi 17h00 + Sortie d'école primaire proche = Risque de friction piéton/véhicule multiplié par 4 »*), là où une formule analytique échouerait par manque de modélisation mathématique explicite.
*   **Générer des alertes sémantiques intelligibles :** Traduire un état de risque matriciel complexe en une instruction verbale claire et priorisée pour l'utilisateur.

---

## 5. Ergonomie Cognitive et Accessibilité pour les Mobilités Douces

### 5.1. Le Syndrome du "Smombie" et la Charge Cognitive
Une littérature scientifique abondante en ergonomie et en psychologie cognitive alerte sur le phénomène du **« Smombie » (*Smartphone Zombie*)** : le piéton ou cycliste absorbé par l'écran tactile de son terminal mobile en marchant ou en roulant.
*   **La théorie de la charge cognitive (Sweller) et l'attention divisée :** La sollicitation du canal visuel pour la lecture d'une carte routière sur un écran réduit jusqu'à **60 % le champ de vision périphérique** et augmente significativement les temps de réaction face à un danger soudain (véhicule franchissant un feu rouge, obstacle sur la chaussée).
*   **Le paradoxe de la navigation IHM :** Les applications de navigation classiques, en exigeant un contact visuel et tactile régulier pour confirmer une instruction ou signaler un danger, augmentent paradoxalement la vulnérabilité de l'usager qu'elles sont censées guider.

### 5.2. Les Interfaces Sensorielles "Hands-Free" (Mains-Libres)
Pour rompre ce paradoxe, l'état de l'art en IHM pour les mobilités douces préconise le découplage des interfaces de l'écran tactile, au profit d'**interfaces sans contact (*Hands-Free / Eyes-Free*)** :
*   **La synthèse vocale proactive (TTS : *Text-to-Speech*) :** Diffusion d'instructions de navigation et d'alertes de sécurité par spatialisation audio dans les écouteurs de l'usager, ajustant dynamiquement le volume et le débit d'élocution au bruit ambiant.
*   **La reconnaissance vocale embarquée :** Capacité d'interagir avec le système (déclencher un appel d'urgence SOS, confirmer un incident routier, demander un recalcul d'itinéraire) par commandes vocales en langage naturel, sans manipulation physique du terminal.

### 5.3. Inclusivité et Profilage Personnalisé
L'un des verrous sociétaux et techniques majeurs de la cartographie actuelle est le postulat de l'**« usager standard »**. Un piéton athlétique, un enfant de 8 ans et une **Personne à Mobilité Réduite (PMR)** en fauteuil roulant ne partagent ni la même cinématique, ni la même perception du risque, ni les mêmes capacités de franchissement topologique.
L'état de l'art exige le passage à un **routement adaptatif par profilage personnalisé :**
*   **Graphes pondérés dynamiquement :** Modification algorithmique des poids des arêtes du graphe routier selon le profil. Pour une PMR, un tronçon comportant des escaliers, un dévers important ou un trottoir non abaissé voit son coût d'accès tendé vers l'infini, forçant l'algorithme (ex: A*) à générer un parcours 100 % accessible.
*   **Réseaux de soins et Geofencing :** Pour les profils à risque (enfants, seniors malorientés), l'implémentation de **barrières géographiques virtuelles (*Geofences*)** couplée à une télémétrie déléguée (*Parental Tracking / Trust Services*) constitue le standard actuel pour garantir une sécurité collaborative et rassurer les aidants sans intrusivité continue.

---

## 6. Analyse Comparative et Benchmarking des Solutions Existantes

Pour situer précisément la proposition de valeur et la contribution scientifique du projet **VRUGuard**, le tableau ci-dessous présente une analyse comparative détaillée des principales solutions et familles technologiques disponibles sur le marché face aux exigences de sécurité active des VRU.

| Critère / Fonctionnalité | Navigation Grand Public<br>*(Google Maps, Waze, Apple Maps)* | Carto Mobilités Douces<br>*(Citymapper, Strava, Bikemap)* | Solutions PMR / Accessibilité<br>*(Wheelmap, Streetmix)* | Matériel Industriel C-ITS / V2P<br>*(Boîtiers DSRC, RSUs urbains)* | **La Plateforme VRUGuard**<br>*(Notre Contribution)* |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Cible principale** | Véhicules motorisés (Voitures) | Cyclistes, Transports, Sportifs | Utilisateurs en fauteuil / PMR | Véhicules connectés, Flottes | **Ensemble des VRU (Piétons, Vélo, PMR, Enfants)** |
| **Précision Géospatiale** | Standard GPS (5 à 15 m)<br>*Imprécis en ville* | Standard GPS (5 à 15 m)<br>*Correction par snap basique* | Standard GPS (5 à 15 m)<br>*Focus sur la base de données* | Centimétrique à métrique<br>*(Capteurs matériels dédiés)* | **Hybride : Standard + RTK/TERIA (< 1 m à centimétrique)** |
| **Profilage & Personnalisation** | Très faible<br>*(Voiture, Piéton, Vélo)* | Moyen<br>*(Type de vélo, effort physique)* | Fort mais mono-cible<br>*(Exclusif PMR)* | Nul<br>*(Identifiant véhicule ou balise)* | **Profond et Dynamique<br>*(Routage sur-mesure par profil)*** |
| **Modélisation Proactive du Risque** | Non<br>*(Affichage trafic / accidents)* | Non<br>*(Focus sur la performance)* | Non<br>*(Focus sur l'infrastucture)* | Oui<br>*(Calcul TTC anti-collision direct)* | **Oui (IA Sentinelle Gemini + Heatmaps en Temps Réel)** |
| **Accessibilité IHM (Hands-Free)** | Guidage vocal basique<br>*Nécessite l'écran tactile* | Très faible<br>*Forte dépendance écran* | Faible<br>*IHM visuelle principalement* | N/A<br>*(Alerte sonore tableau de bord)* | **Totale : TTS Proactif + Contrôle Vocal In-App** |
| **Collaboratif & Crowdsourcing** | Fort (Waze)<br>*Mais orienté automobile* | Moyen<br>*(Signalement obstacles vélo)* | Fort<br>*(Recensement accessibilité)* | Nul<br>*(Données capteurs automatisées)* | **Fort (Incidents VRU en live + Modération IA)** |
| **Réseau de Confiance & SOS** | Partage de position simple<br>*(Google Location Share)* | Beacon / LiveTrack<br>*(Partage position sportive)* | Non | Non | **Intégré (TripRooms, SOS anti-erreur, Suivi Parental)** |
| **Architecture Logicielle** | Applications NATIVES propriétaires | Applications NATIVES / Web | Web / Applications NATIVES | Systèmes embarqués (Firmware/IoT) | **SaaS Cross-Platform (Web, Android, iOS - Code Unique)** |

### Synthèse des Verrous Identifiés dans l'Existant :
1.  **Le fossé entre navigation et protection :** Les applications leaders du marché (Google Maps, Waze) excellent dans l'optimisation des temps de trajet pour les véhicules, mais sont structurellement inadaptées à la prévention des collisions corporelles pour les piétons ou cyclistes en raison de leur imprécision spatiale.
2.  **La fragmentation des solutions :** L'utilisateur est aujourd'hui contraint de multiplier les applications spécialisées : une application pour le parcours à vélo (Strava), une autre pour l'accessibilité PMR (Wheelmap), et une troisième pour le partage de position en sécurité (Life360).
3.  **L'inaccessibilité du matériel professionnel :** Si les technologies C-ITS et RTK offrent des performances géospatiales exceptionnelles, elles restent confinées au secteur industriel ou automobile en raison du coût des équipements et du blocage des protocoles par les navigateurs standards.

---

## 7. Conclusion de l'État de l'Art : Positionnement Scientifique de VRUGuard

L'état de l'art met en lumière une **opportunité scientifique et technologique majeure** : combler le fossé entre l'imprécision des outils grand public de mobilité et la complexité des systèmes industriels C-ITS haute précision, tout en plaçant l'humain et ses spécificités physiques au centre du calcul algorithmique.

Le projet **VRUGuard** se positionne comme une **réponse globale et intégrée** à ces défis techniques par quatre ruptures architecturales :
1.  **L'hybridation instrumentale (Edge/RTK) :** L'interfaçage transparent d'un socle logiciel Cross-Platform (React/Capacitor) avec des récepteurs GNSS coopératifs via des ponts WebSockets et plugins natifs, rendant la précision centimétrique (réseau TERIA) accessible sur des terminaux mobiles de consommation courante.
2.  **L'intelligence prédictive multimodale :** L'exploitation d'une architecture orientée services couplée aux LLM (Sentinelle Gemini) et à une base documentaire NoSQL temps réel (Firestore) pour transformer des données brutes hétérogènes (météo, flux, topologie) en **matrices de risques spatialisées (Heatmaps)** dynamiques.
3.  **L'inclusivité algorithmique par profilage :** L'inversion du paradigme de routage traditionnel par l'adaptation temps réel du graphe de navigation aux contraintes d'accessibilité (PMR) et aux profils de vulnérabilité (enfants, personnes âgées).
4.  **L'ergonomie cognitive zéro-distraction :** La suppression du risque « Smombie » par l'intégration d'un moteur vocal proactif bidirectionnel (TTS et reconnaissance vocale), élevant le smartphone du statut de simple outil de guidage visuel à celui de **bouclier numérique de sécurité active**.
