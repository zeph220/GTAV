# ADR-0001 — Progression et persistance joueur

- Statut : accepté pour l'itération 5
- Portée : `src/gameplay/progression` et `src/gameplay/save`

## Contexte

Le plan de build demande une réputation par faction, une progression joueur et des sauvegardes. Le monde ECS ne fournit pas d'accès réflexif à tous ses composants et les plateformes de stockage du jeu ne sont pas encore figées.

## Décision

1. La réputation et la progression restent des composants ECS data-only pilotés par des systèmes de gameplay.
2. La réputation est conservée séparément par identifiant de faction et bornée par défaut à [-100, 100].
3. L'expérience est cumulative ; les niveaux accordent des points de compétence qui sont dépensés pour débloquer des aptitudes déclaratives.
4. La sauvegarde utilise un contrat asynchrone `SaveStorage` indépendant de la plateforme.
5. Les données ECS sont sérialisées uniquement par des `SaveSectionAdapter` explicites. Aucun accès privé au registre ECS ni sérialisation réflexive n'est ajouté à `World`.
6. Le format `nova-city.save` est versionné. La version 1 couvre position/orientation, santé, inventaire, réputation, progression et journal de missions. Les sections inconnues sont ignorées ; les versions inconnues sont refusées.
7. Le chargement valide les sections connues avant de modifier l'entité cible. Le backend de stockage concret est injecté : stockage mémoire pour les tests, adaptateur Web Storage pour le navigateur.

## Conséquences

- Tout nouveau composant à sauvegarder doit fournir un adaptateur et un test.
- Un changement incompatible du format nécessite une nouvelle version et une migration explicite.
- L'identifiant d'entité sauvegardé est une métadonnée de provenance ; le chargement restaure les données sur l'entité joueur fournie, qui peut avoir un nouvel identifiant.
- Le streaming du monde, les états de véhicules et la synchronisation cloud ne sont pas couverts par cette version.

## Validation

Tests unitaires ajoutés pour les paliers de réputation, niveaux, aptitudes, restauration de composants, journal de missions, rejet de données invalides et gestion des emplacements.
