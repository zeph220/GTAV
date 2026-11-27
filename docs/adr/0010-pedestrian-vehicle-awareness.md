# ADR 0010 — Perception des véhicules par l'IA piétonne

- Statut : accepté
- Date : 2026-11-27
- Périmètre : `src/ai/**`, `src/rendering/VehicleScene.tsx` et composition de l'application

## Contexte

Les civils savent déjà fuir les menaces fournies par `PedestrianSystemOptions.threats`, mais cette entrée n'est pas alimentée par les voitures de la session jouable. Les simulations des véhicules et des piétons restent indépendantes, ce qui évite de coupler l'IA au système physique ou à Three.js.

## Décision

- Conserver une source de menaces injectée sous forme de fonction en lecture seule dans `PedestrianSession`.
- Publier depuis la scène véhicule des instantanés de position des voitures joueur et trafic, avec un rayon de perception adapté au type de véhicule.
- Transmettre ces instantanés via la composition React avec des callbacks stables et une référence mutable ; ne pas déclencher de rendu React à chaque mesure.
- Échantillonner les véhicules à une cadence suffisante pour les réactions piétonnes (environ 8 Hz), puis laisser `PedestrianSystem` décider des fuites sur le graphe de trottoirs existant.
- Vider immédiatement la source de menaces quand la conduite est inactive ou démontée.
- Garder le contrat `PedestrianThreat` dans `src/ai`, sans dépendance de l'IA vers les véhicules, le renderer ou `src/shared`.

## Conséquences

- Les civils s'écartent réellement des voitures en circulation et du véhicule contrôlé par le joueur.
- Les chemins de fuite restent calculés sur les trottoirs ; aucune nouvelle logique de mouvement n'est dupliquée dans le renderer.
- Les distances de perception et la cadence de publication sont configurables dans la couche d'intégration ultérieure.
- Les collisions physiques et les dégâts restent hors périmètre de cette itération.
