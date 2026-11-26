# Gangs fictifs — Itération 6

Ce module appartient à `src/ai/**`.

- `NOVA_CITY_GANGS` déclare trois factions originales avec des identifiants stables.
- `GangSystem.registerTerritory` reçoit les positions et rayons fournis par le monde.
- `GangSystem.spawnMember` et `registerMember` gèrent les membres ECS.
- `trackPlayer` active les transitions d'entrée/sortie de territoire.
- La réputation existante pilote les états non létaux des membres : idle, alert et confronting.
- Les relations entre factions sont configurables, symétriques et neutres par défaut.

Aucun modèle visuel, déplacement, dégât ou logique de trafic n'est inclus dans ce module.
