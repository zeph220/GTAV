# Rendu 3D — NOVA CITY

Le module de rendu transforme les données déterministes de `src/world` en objets Three.js via React Three Fiber. Le modèle monde reste la source de vérité ; cette couche ne modifie ni la simulation ECS ni les contrats de `src/shared`.

## Scène urbaine

`CityScene` reçoit un objet `GeneratedCity` et construit :

- le terrain triangulé, avec normales calculées et couleurs interpolées selon l'altitude ;
- des chaussées, bordures et marquages différenciés entre axes principaux et rues locales ;
- des bâtiments instanciés par style, avec vitrages placés sur les façades et tenant compte de leur rotation ;
- des arbres de rue instanciés (troncs et couronnes) ;
- un éclairage hémisphérique et directionnel, des ombres et un brouillard atmosphérique ;
- une caméra orbitale pilotée à la souris : glisser pour tourner, molette pour zoomer et clic droit + glisser pour déplacer le point de vue.

Les géométries statiques sont combinées en buffers et les éléments répétés passent par des `InstancedMesh` pour réduire le nombre d'objets et d'appels de dessin.

## Utilisation

```tsx
import { Canvas } from "@react-three/fiber";
import { generateCity } from "../world";
import { CityScene } from "./rendering";

const city = generateCity({ seed: "nova-city-preview" });

<Canvas shadows camera={{ position: [790, 730, 930], fov: 43 }}>
  <CityScene city={city} />
</Canvas>;
```

## Limites actuelles

Le rendu est procédural et stylisé : façades et végétation sont générées par géométrie, sans bibliothèque externe d'assets. Cette itération ne comprend pas encore de textures photographiques haute résolution, de shaders météo, d'éclairage global, de LOD, de streaming ni de conduite. Ces travaux doivent rester des étapes mesurées, testées sur les navigateurs cibles.
