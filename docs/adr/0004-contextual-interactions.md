# ADR 0004 — Interactions contextuelles ECS

- Statut : accepté
- Date : 2026-11-27
- Périmètre : `src/gameplay/**`

## Contexte

Les missions prennent déjà en charge les objectifs `interact` et `talk-to`, mais aucun système gameplay générique ne sélectionne une cible proche ni ne traite une demande d'interaction.

## Décision

Ajouter un composant `Interactable` et un `InteractionSystem` indépendant du rendu. La sélection utilise la distance 3D, puis la priorité, puis l'identifiant d'entité pour rester déterministe. Les interactables peuvent être activés/désactivés, avoir un rayon, un cooldown et un nombre d'utilisations limité.

Le système expose un prompt de proximité et émet un callback typé après interaction réussie ; l'intégrateur peut le relier à `MissionSystem.reportEvent`, aux dialogues ou aux services du monde. Aucun accès direct aux missions, à l'économie, au monde ou au rendu n'est ajouté.

## Conséquences

- Un même mécanisme supporte portes, PNJ, points de mission, commerces et objets.
- Les prompts restent des données ; le rendu décide de leur présentation.
- Aucun contrat `src/shared/**` n'est modifié.
