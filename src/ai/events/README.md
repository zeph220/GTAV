# Événements dynamiques — Itération 6

Ce module appartient à `src/ai/**`.

Le monde fournit les lieux via `DynamicEventDirector.registerLocation`. Chaque lieu
contient un identifiant stable, un district, une position et des tags. Le catalogue
`NOVA_CITY_DYNAMIC_EVENTS` utilise ces tags pour sélectionner uniquement des sites
compatibles.

Le directeur applique une sélection pondérée, des délais de réapparition et un
nombre maximal d'événements simultanés. Chaque occurrence est une entité ECS avec
un état, une durée, une progression et la liste des participants. Les interactions
du joueur font avancer la progression via `contribute`.

Les callbacks de cycle de vie sont les points d'intégration avec les autres
systèmes. Aucun gain d'XP, mouvement de véhicule, fermeture de route ou effet
visuel n'est exécuté directement ici.
