# ADR 0005 — Attribution des récompenses de mission

- Statut : accepté
- Date : 2026-11-27
- Périmètre : `src/missions/**`

## Contexte

Les définitions de mission peuvent annoncer de l'expérience, des objets et de l'argent, mais la fin d'une mission ne distribue pas encore ces récompenses. L'attribution doit réutiliser les systèmes de progression et d'inventaire existants sans coupler le système de missions à une économie qui n'est pas encore implémentée.

## Décision

Ajouter `MissionRewardService`, un adaptateur explicite à appeler depuis le callback `MissionSystem.onCompleted`. Il distribue l'expérience via `ProgressionSystem`, les objets via `addItem`, et délègue l'argent à un callback fourni par le futur système économique. Il expose les quantités réellement attribuées et les objets restant à distribuer si l'inventaire est plein.

Le service refuse les missions non terminées, valide les montants et protège contre une double attribution pendant sa durée de vie. Il ne crée aucun portefeuille fictif et ne modifie aucun contrat partagé.

## Conséquences

- Les récompenses XP et objets sont utilisables dès maintenant.
- L'argent reste explicitement en attente tant qu'aucun adaptateur économique n'est fourni.
- L'intégration reste optionnelle et rétrocompatible avec `MissionSystem`.
