# ADR 0009 — Intégration de la population piétonne à NOVA CITY

- Statut : accepté
- Date : 2026-11-27
- Périmètre : `src/ai/**` et `src/rendering/**`

## Contexte

Les systèmes civils et le pathfinding piéton existent, mais le jeu ne construit pas encore de graphe de trottoirs à partir du monde généré, ne crée pas de population en session et n'affiche pas les civils dans la scène.

## Décision

- Dériver deux bandes de cheminement piéton de chaque segment routier, décalées de la demi-largeur de chaussée et d'un recul de trottoir.
- Relier les cheminements aux angles des intersections, sans créer de liaison directe entre les deux côtés d'une même chaussée.
- Faire utiliser exclusivement les nœuds de navigation pour les destinations d'errance et de fuite ; ne pas choisir de destination arbitraire au milieu de la route ou dans les bâtiments.
- Créer une session civile indépendante du renderer avec population et décisions déterministes à partir de la graine de ville.
- Garder les humains procéduraux dans la couche R3F, avec des maillages instanciés et une simulation ECS indépendante de Three.js.
- Ne pas modifier `src/shared/**` ni les contrats génériques de l'ECS.

## Conséquences

- La ville présente une population piétonne persistante et reproductible.
- Les civils marchent, attendent, se promènent et s'éloignent des menaces en restant sur le graphe piéton.
- Le rendu utilise des instances pour limiter le coût des populations.
- Les traversées protégées, les feux piétons, les interactions détaillées et les réactions avancées aux véhicules restent des évolutions ultérieures.
