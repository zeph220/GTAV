# Police — Itération 3

## Signalement d'incident

Le système de combat signale les agressions réussies via `CombatSystem.onAssault`.
Raccordez ce callback à `PoliceSystem.reportIncident` (voir
`src/gameplay/combat/README.md`). Les incidents augmentent la chaleur et
déterminent un niveau de recherche de 0 à 5.

## Réponse

`PoliceSystem` génère un officier par niveau de recherche depuis les points
de spawn fournis, ou à défaut autour du suspect. Les officiers empruntent le
graphe piéton lorsqu'ils sont éloignés, passent en poursuite directe à courte
distance et interpellent le suspect lorsqu'ils le maintiennent à portée.
Une interpellation réussie remet le niveau de recherche à zéro et marque le
suspect comme détenu.

La chaleur retombe si aucun officier ne reste dans le rayon de recherche après
le délai configuré. Les paramètres de portée, vitesse, durée d'interpellation,
spawn et décroissance sont configurables dans `PoliceSystemOptions`.

Le module reste découplé du rendu et des véhicules. Le monde fournit ses
points de spawn et son `NavGraph`.
