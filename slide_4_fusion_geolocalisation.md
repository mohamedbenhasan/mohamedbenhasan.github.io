# Géolocalisation

## 4️⃣ Fusion multisource & Recalage

* **Synthèse algorithmique :** Combinaison mathématique des sources validées à l'étape 3 pour générer une position unique et optimale.

* **Pondération dynamique (Filtre de confiance) :** 
  L'algorithme attribue un "poids" à chaque source en temps réel, basé sur les métadonnées extraites à l'étape 2 (qualité du fix, nombre de satellites).
  * **Haute Précision (TERIA) :** Poids maximal si la trame GGA indique un "RTK Fix" (précision centimétrique).
  * **Mode Coopératif (Ancrages) :** Recalage absolu (*Snap-to-anchor*) si l'usager passe à proximité d'une infrastructure connue.

* **Recalage de position (Dead Reckoning) :**
  * Compensation immédiate en cas d'interruption totale des sources GNSS/TERIA (ex : tunnel, canyon urbain).
  * Exploitation de l'IMU du smartphone (Accéléromètre, Gyroscope) pour déduire la trajectoire à partir de la dernière position valide.

---

### 🧮 Modèle mathématique de la combinaison (Filtre pondéré)

La position finale est calculée selon l'équation des moindres carrés pondérés :

$$ P_{fusion} = \frac{W_{TERIA} P_{TERIA} + W_{GNSS} P_{GNSS} + W_{IMU} P_{IMU}}{W_{TERIA} + W_{GNSS} + W_{IMU}} $$

*(Où le poids $W_i = \frac{1}{\sigma_i^2}$, c'est-à-dire que le poids $W$ d'une source est inversement proportionnel à sa variance d'erreur $\sigma^2$)*

---

### 🎙️ Notes pour l'orateur (Discours) :

> "Nous arrivons à la 4ème étape, qui est le cœur de notre intelligence de localisation. Aux étapes précédentes, nous avons acquis, normalisé et vérifié nos sources.
> 
> Maintenant, il faut les fusionner. Notre algorithme ne choisit pas aveuglément un capteur, il applique une **pondération dynamique**. Si l'on regarde la mécanique mathématique derrière cette pondération (comme illustré sur l'équation), nous utilisons un modèle de filtre pondéré. La position finale est la somme des positions données par TERIA, le GPS et l'IMU, multipliées par leur 'Poids' respectif (W).
>
> Ce poids correspond à l'inverse de la variance d'erreur de chaque source. Concrètement, grâce aux trames NMEA normalisées à l'étape 2, si l'algorithme lit que TERIA offre un 'RTK Fix', son incertitude est quasi-nulle. Son poids mathématique devient énorme et nous offre une position centimétrique.
> 
> À l'inverse, si l'étape 3 nous signale une coupure totale du réseau GNSS — par exemple si le cycliste entre dans un tunnel —, la variance du signal satellite explose. Son poids tombe à zéro, et c'est l'équation cinématique de l'IMU (le Dead Reckoning, via l'accéléromètre et le gyroscope) qui prend le relais pour maintenir la trajectoire à l'estime. 
>
> C'est cette logique mathématique exacte qui garantit à notre système une **haute précision** couplée à une **haute disponibilité**."
