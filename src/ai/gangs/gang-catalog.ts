import type { GangDefinition } from "./gang-system";
import { GangSystem, type GangRelationship, type GangSystemOptions } from "./gang-system";

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

export interface GangRelationshipDefinition {
  fromGangId: string;
  toGangId: string;
  relationship: GangRelationship;
}

export const NOVA_CITY_GANG_RELATIONSHIPS: readonly GangRelationshipDefinition[] = Object.freeze([
  {
    fromGangId: "northbank-circle",
    toGangId: "harbor-line",
    relationship: "unfriendly",
  },
  {
    fromGangId: "northbank-circle",
    toGangId: "orchard-crew",
    relationship: "friendly",
  },
  {
    fromGangId: "harbor-line",
    toGangId: "orchard-crew",
    relationship: "hostile",
  },
]);

/** Creates the NOVA CITY faction registry; map territories are registered separately by src/world. */
export function createNovaCityGangSystem(options: GangSystemOptions = {}): GangSystem {
  const system = new GangSystem(options);
  for (const gang of NOVA_CITY_GANGS) system.registerGang(gang);
  for (const relation of NOVA_CITY_GANG_RELATIONSHIPS) {
    system.setRelationship(relation.fromGangId, relation.toGangId, relation.relationship);
  }
  return system;
}
