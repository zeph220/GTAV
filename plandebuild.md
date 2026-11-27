PLANDEBUILD.md
Project Phoenix
Mission

Créer un jeu navigateur AAA-like inspiré des mécaniques générales des jeux open-world modernes :

monde ouvert urbain ;
circulation routière ;
piétons IA ;
missions scénarisées ;
économie ;
police ;
véhicules ;
exploration ;
progression du joueur ;
coopératif futur.

Le projet doit rester :

original ;
libre de toute propriété intellectuelle tierce ;
sans références directes à GTA, Rockstar, Los Santos, Michael, Trevor, Franklin, etc.
Contraintes techniques
Stack imposée

Frontend :

TypeScript
React
Three.js
React Three Fiber
Zustand

Backend :

Node.js
Fastify
TypeScript

Data :

SQLite durant le développement
PostgreSQL ensuite

Build :

Vite

Tests :

Vitest
Playwright

Qualité :

ESLint
Prettier
Règles Git
Branches

ChatGPT :

chatgpt/*


Mistral :

mistral/*


Intégration :

develop


Production :

main

Interdiction absolue

Aucune IA ne doit modifier :

les dossiers appartenant à l’autre IA ;
les fichiers système hors de son périmètre ;
les modules déjà verrouillés.
Répartition des responsabilités
ChatGPT

Responsable :

Gameplay
src/gameplay


Contient :

déplacements
combat
armes
inventaire
progression
missions
IA
src/ai


Contient :

comportements piétons
police
trafic routier
réactions environnementales
Missions
src/missions

Mistral

Responsable :

Monde
src/world


Contient :

génération urbaine
routes
districts
bâtiments
Graphismes
src/rendering


Contient :

shaders
lumières
météo
post-processing
Véhicules
src/vehicles


Contient :

physique
conduite
trafic
Dossier partagé

Uniquement :

src/shared


Contient :

types
interfaces
constantes
événements

Toute modification :

compatible rétroactivement ;
documentée.
Univers

Ville originale :

NOVA CITY

Quartiers :

Downtown
Financial District
Industrial Sector
Harbor
University Zone
Residential Hills
Airport
Old Town
Contenus interdits

Afin de conserver un PEGI raisonnable :

Interdits :

clubs de strip-tease ;
prostitution ;
contenu sexuel ;
drogues consommables ;
torture ;
contenu extrémiste ;
paris réels ;
lootboxes payantes.

Autorisés :

criminalité fictive ;
poursuites ;
braquages non réalistes ;
humour ;
action.
Architecture ECS

Entity Component System obligatoire.

Entités

Exemples :

joueur
piéton
véhicule
policier
bâtiment
Components

Exemples :

Transform
Health
Vehicle
Weapon
AI
Inventory
Systems

Exemples :

MovementSystem
CombatSystem
TrafficSystem
WeatherSystem
PoliceSystem
Plan de développement
ITERATION 1
ChatGPT

Créer :

système ECS minimal
déplacement joueur
caméra troisième personne
inventaire basique

Livrables :

src/gameplay/*
src/shared/*

Mistral

Créer :

terrain
routes
bâtiments procéduraux
système de rendu

Livrables :

src/world/*
src/rendering/*

ITERATION 2
ChatGPT

Créer :

PNJ basiques
pathfinding
comportements civils

Livrables :

src/ai/*

Mistral

Créer :

véhicules
circulation
parking dynamique

Livrables :

src/vehicles/*

ITERATION 3
ChatGPT

Créer :

armes non létales
combat
dégâts
système de police

Livrables :

src/gameplay/combat
src/ai/police

Mistral

Créer :

météo dynamique
cycle jour/nuit
shader atmosphérique

Livrables :

src/rendering/weather

ITERATION 4
ChatGPT

Créer :

système de missions
quêtes
dialogues

Livrables :

src/missions/*

Mistral

Créer :

commerces
économie locale
intérieurs génériques

Livrables :

src/world/interiors

ITERATION 5
ChatGPT

Créer :

réputation
progression
sauvegardes
Mistral

Créer :

optimisation
LOD
streaming monde
ITERATION 6
ChatGPT

Créer :

gangs fictifs
événements dynamiques
Mistral

Créer :

trafic avancé
accidents
réactions environnementales
## Reprise des modules monde, rendu et véhicules — itérations 10 à 12

Les fondations des modules monde/rendu/véhicules ont été reprises sur `main` afin de poursuivre l'intégration technique. Cette reprise conserve les frontières de modules et n'autorise pas de modification non documentée de `src/shared`.

- **Itération 10 — Monde :** terminée. Génération déterministe des huit quartiers, îlots, graphe routier connecté, bâtiments et terrain.
- **Itération 11 — Rendu :** terminée. Scène React Three Fiber raccordée au monde, terrain coloré, chaussées et marquages, bâtiments et vitrages instanciés, arbres, éclairage, ombres, brouillard, commandes orbitales et rendu à la demande.
- **Itération 12 — Véhicules :** terminée. Composants ECS dédiés, modèle de conduite arcade à masse et forces (accélération, freinage, marche arrière, traînée et braquage), calcul d'itinéraires Dijkstra sur les routes générées, suivi autonome de waypoints, une voiture jouable au clavier et un véhicule de circulation autonome, caméra de poursuite et HUD de vitesse. Les collisions, suspensions, glissement latéral, dégâts, trafic dense et stationnement dynamique restent hors périmètre.

Chaque étape doit respecter la définition de terminé ci-dessous : lint, typage, tests unitaires, tests navigateur, build et documentation.

Règles anti-collision

Chaque IA :

ne modifie que son arborescence ;
passe par interfaces partagées ;
ne touche jamais une PR déjà validée ;
crée un ADR avant changement d’architecture.
Définition de terminé

Une fonctionnalité est terminée si :

build sans erreur ;
lint sans erreur ;
tests verts ;
documentation mise à jour ;
aucune régression.
Objectif final

Créer un jeu navigateur open-world original comprenant :

grande ville explorable ;
véhicules ;
circulation crédible ;
police ;
missions ;
météo ;
cycle jour/nuit ;
économie ;
progression ;
performances compatibles navigateur moderne.

Le projet doit rester 100 % original, sans reproduire directement les éléments protégés d’un jeu commercial existant.
