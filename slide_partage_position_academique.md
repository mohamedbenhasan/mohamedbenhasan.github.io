# Mécanismes de Partage de Position : Supervision Tierce

## Objectif scientifique & sécuritaire
Instaurer une couche de **sécurité par supervision tierce**. Permettre à un contact de confiance d'accéder à la télémétrie de l'usager vulnérable, de manière ponctuelle ou continue, tout en respectant le principe de **Privacy by Design** (confidentialité dès la conception).

---

## 1. Mode Éphémère : Partage de Session (Stateless)
*Destiné à une supervision ponctuelle (ex: un trajet spécifique).*

* **Accès par jeton (Token-based) :** Génération d'un lien sécurisé unique ; le destinataire n'a pas besoin de compte sur l'infrastructure VRUGuard.
* **Cycle de vie contrôlé (TTL) :** Paramétrage d'un *Time-To-Live* (durée d'expiration automatique fixée à 2 heures par défaut).
* **Révocation asynchrone :** Interruption manuelle possible à tout instant par l'émetteur, ou destruction automatique de la session à expiration.

## 2. Mode Persistant : Couplage Authentifié (Stateful)
*Destiné à une supervision de fond (ex: lien parent-enfant, aidants pour PMR).*

* **Appairage cryptographique :** Création d'une liaison persistante entre deux comptes VRUGuard formellement identifiés dans la base de données.
* **Télémétrie continue :** Flux de données ininterrompu sans contrainte de session temporelle.
* **Consentement bilatéral :** Validation explicite (Opt-in) requise par les deux entités, garantissant le respect de la vie privée et prévenant le suivi abusif.

---

### 🎙️ Notes pour l'orateur (Discours de soutenance) :

> "J'aborde à présent la dimension de supervision tierce de VRUGuard : le partage de position. L'enjeu académique et technique ici était de trouver l'équilibre parfait entre la sécurité de l'usager vulnérable et le respect strict de sa vie privée, ce qu'on appelle le *Privacy by Design*.
> 
> Pour y répondre, nous avons implémenté deux architectures distinctes. 
> 
> La première est un **Partage Éphémère basé sur des sessions**. Techniquement, le système génère un jeton d'accès sécurisé sous forme de lien. C'est une approche 'sans état' pour le destinataire, qui n'a pas besoin de compte. La sécurité est garantie par un Time-To-Live (un TTL de 2 heures) qui détruit automatiquement la session, évitant ainsi qu'un lien oublié ne devienne une faille de suivi.
> 
> La seconde approche est le **Partage Persistant**. Ici, on entre dans une architecture couplée entre deux comptes authentifiés, ce qui est particulièrement pertinent pour les aidants de Personnes à Mobilité Réduite (PMR) ou le suivi familial. La donnée coule en continu, mais elle est verrouillée par un mécanisme de consentement bilatéral explicite. 
> 
> Ces deux modes garantissent que la télémétrie ne quitte l'appareil de l'usager que sous son contrôle absolu, condition *sine qua non* pour l'acceptabilité d'une application de sécurité personnelle."
