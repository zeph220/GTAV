# Monde procédural — NOVA CITY

L'itération 10 pose la première implémentation du périmètre monde. Le module `src/world` est du TypeScript pur : il ne dépend ni de Three.js, ni de React, ni du gameplay ECS.

## Génération

`generateCity` construit une ville déterministe à partir d'une graine :

```ts
import { generateCity } from "./world";

const city = generateCity({ seed: "nova-city-preview" });
console.log(city.districts);
console.log(city.roadNetwork.nodes, city.roadNetwork.segments);
console.log(city.buildings, city.terrain);
```

La configuration par défaut produit huit quartiers de 320 × 320 unités, quatre blocs par côté et par quartier, un réseau routier connecté et un maillage de terrain. Les options `blocksPerDistrict` (2 à 8) et `terrainSegmentsPerDistrict` (1 à 16) permettent de régler la densité logique et la résolution du terrain.

## Données fournies

- **Quartiers** : Downtown, Financial District, Industrial Sector, Harbor, University Zone, Residential Hills, Airport et Old Town, avec emprises et profils de densité/style propres.
- **Routes** : intersections partagées entre segments, routes principales et locales, largeur et rattachement au quartier.
- **Îlots et bâtiments** : lots contenus dans chaque îlot, densité et typologie issues du quartier, empreinte, hauteur et rotation.
- **Terrain** : surface triangulée, grille de positions X/Y/Z et fonction continue `sampleTerrainHeight`. La topographie comprend une élévation douce vers Residential Hills.

Les identifiants et les données sont reproductibles pour une graine et une configuration identiques. X/Z représentent le plan horizontal ; Y représente l'altitude. Les routes et bâtiments échantillonnent la même fonction de terrain.

## Intégration à venir

Le rendu transformera le maillage et les empreintes en géométries Three.js, puis ajoutera matériaux, textures, éclairage, végétation et détails. Le module véhicules pourra exploiter directement le graphe routier. Cette itération ne prétend pas encore fournir de modèles 3D, de shaders, de météo, de textures ou de conduite.
