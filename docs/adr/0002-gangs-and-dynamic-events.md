# ADR 0002 — Gangs fictifs et événements dynamiques

- **Statut :** accepté
- **Itération :** 6
- **Périmètre :** `src/ai/**`

## Contexte

L'itération 6 ajoute des factions fictives et des situations de quartier évoluant pendant la simulation. Ces fonctionnalités doivent rester indépendantes du moteur 3D, ne pas imposer de nouvelles dépendances au monde ou aux véhicules et réutiliser les contrats de gameplay déjà présents.

## Décision

### Factions et territoires

- Les gangs sont définis par des identifiants stables et des données éditoriales originales dans un catalogue.
- Les territoires sont enregistrés à l'exécution avec un identifiant de district, un centre et un rayon fournis par le système monde.
- Les membres sont des entités ECS portant un composant `GangMember`, sans modèle 3D ni logique de déplacement propriétaire.
- Les relations entre factions sont configurables et les réactions envers le joueur s'appuient sur le composant de réputation existant.
- Les réactions d'un membre sont des états non létaux (`idle`, `alert`, `confronting`, `retreating`) exposés par callbacks ; la police, le renderer et le monde restent des consommateurs externes.

### Événements dynamiques

- Un `DynamicEventDirector` enregistre un catalogue de définitions et des points de localisation fournis par le monde.
- La sélection automatique est pondérée, déterministe en test grâce à une fonction aléatoire injectable, plafonnée en nombre d'événements et protégée par des délais de réapparition.
- Chaque occurrence est une entité ECS versionnée par identifiant, position, district, état, durée et progression.
- Les interactions du joueur contribuent explicitement à l'événement. Complétion, expiration et progression sont exposées par callbacks ; le directeur n'accorde pas lui-même XP, argent ou réputation.
- Le système n'invente aucune coordonnée de ville : sans points de localisation valides, aucune occurrence automatique n'est créée.

## Interfaces

- Les types spatiaux réutilisent `Vec3`.
- Les entités réutilisent `World`, `Transform` et les composants ECS existants.
- La réputation réutilise `ReputationSystem` et ses identifiants de faction.
- Les lieux sont injectés via `registerLocation`; le monde peut ainsi adapter ses districts, places et zones d'activité sans dépendance inverse.
- Aucun changement de `src/shared/**` n'est requis.

## Conséquences

La simulation peut activer des factions et des événements sans couplage à Three.js, à la navigation des véhicules ou aux scènes. Les intégrations concrètes du monde et des accidents restent dans les périmètres Mistral. Les récompenses et conséquences persistantes sont déléguées aux systèmes de progression et de missions via callbacks explicites.
