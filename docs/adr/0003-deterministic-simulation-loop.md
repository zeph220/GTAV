# ADR 0003 — Boucle de simulation déterministe

- Statut : accepté
- Date : 2026-11-27
- Périmètre : `src/gameplay/**`

## Contexte

Les systèmes ECS reçoivent actuellement un delta en secondes, mais le dépôt ne fournit pas encore d'ordonnanceur commun. Chaque intégration pourrait donc appeler les systèmes dans un ordre différent ou leur transmettre un delta dépendant du taux de rafraîchissement, ce qui rendrait les interactions et les tests moins reproductibles.

## Décision

Ajouter `GameSimulation`, un ordonnanceur indépendant du navigateur et du moteur de rendu, qui :

- possède ou reçoit une instance `World` ;
- exécute les `GameSystem` avec un pas fixe configurable (60 Hz par défaut) ;
- trie les systèmes par priorité puis par ordre d'enregistrement ;
- accumule les deltas de rendu, borne les grands deltas et limite le rattrapage par frame ;
- expose pause, désinscription, remise à zéro de l'accumulateur et snapshot de diagnostic ;
- empêche les appels réentrants et les configurations invalides.

Les systèmes restent propriétaires de leurs données ECS. Le scheduler ne connaît ni Three.js, ni React, ni les contrats du monde. Les changements de système effectués pendant un tick prennent effet au tick suivant, sauf suppression d'un système non encore exécuté qui est honorée immédiatement.

## Conséquences

- Les systèmes de gameplay peuvent être testés et exécutés dans un ordre stable.
- Le rendu peut appeler `advance(frameDeltaSeconds)` sans imposer sa fréquence à la simulation.
- Les intégrateurs doivent choisir des priorités explicites lorsque l'ordre entre systèmes est important.
- Les grands retards sont volontairement abandonnés au-delà de la limite de rattrapage afin d'éviter une boucle de rattrapage infinie.
- Aucun contrat dans `src/shared/**` n'est modifié.
