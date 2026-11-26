import type { GangDefinition } from "./gang-system";

/** Factions fictives créées pour NOVA CITY. Les territoires sont fournis par le monde. */
export const NOVA_CITY_GANGS: readonly GangDefinition[] = Object.freeze([
  {
    id: "northbank-circle",
    name: "Northbank Circle",
    homeDistrict: "Downtown",
    description: "Un réseau de quartier attaché aux commerces indépendants de Northbank.",
  },
  {
    id: "harbor-line",
    name: "Harbor Line",
    homeDistrict: "Harbor",
    description: "Un collectif portuaire organisé autour des anciens entrepôts.",
  },
  {
    id: "orchard-crew",
    name: "Orchard Crew",
    homeDistrict: "Residential Hills",
    description: "Un groupe local très présent dans les rues résidentielles des collines.",
  },
]);
