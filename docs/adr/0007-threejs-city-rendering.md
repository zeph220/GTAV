# ADR 0007 — Scène urbaine Three.js à partir des données monde

- Statut : accepté
- Date : 2026-11-27
- Périmètre : `src/rendering/**` et raccordement du point d'entrée client

## Contexte

L'itération 10 a introduit un monde logique déterministe, indépendant du moteur graphique. Le client rend encore une scène de démarrage. Il faut une couche de présentation qui transforme les données de terrain, de routes et de bâtiments en géométrie Three.js sans mélanger la simulation et le rendu.

## Décision

- Construire la scène via React Three Fiber, à partir de `generateCity`.
- Convertir le terrain, les chaussées, les trottoirs et le marquage en géométries combinées.
- Utiliser des instances GPU groupées par style pour les bâtiments, vitrages et arbres afin de limiter les appels de dessin.
- Utiliser des matériaux standard PBR, des couleurs de terrain par altitude, un éclairage directionnel avec ombres et un brouillard atmosphérique.
- Conserver un mode d'affichage interactif menu / jeu / pause et rendre les statistiques du monde visibles dans l'interface.
- Garder `src/world` comme source de vérité : aucun calcul visuel n'est réinjecté dans le modèle monde, et aucun contrat `src/shared` n'est modifié.

## Conséquences

- Le prototype affiche une ville 3D complète au lieu d'une géométrie de test.
- La géométrie statique est construite une fois par graine et les bâtiments répétitifs sont instanciés.
- Les matériaux et détails sont stylisés et procéduraux : aucun fichier de texture externe ou modèle propriétaire n'est requis.
- Cette étape n'est pas encore une optimisation complète du monde ouvert (LOD, streaming, éclairage dynamique et textures haute résolution restent des étapes distinctes).
