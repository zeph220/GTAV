import type { DialogueDefinition } from "./dialogue-system";
import type { MissionDefinition } from "./mission-types";

export const NOVA_CITY_STARTER_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "first-day-nova-city",
    title: "Premiers repères",
    description: "Faites connaissance avec le quartier et retrouvez la coordinatrice du centre civique.",
    contactId: "civic-coordinator",
    objectives: [
      {
        id: "reach-civic-plaza",
        type: "reach-location",
        targetId: "civic-plaza",
        description: "Rejoindre la place du Centre civique",
      },
      {
        id: "talk-coordinator",
        type: "talk-to",
        targetId: "civic-coordinator",
        description: "Parler à la coordinatrice",
      },
      {
        id: "visit-transit-hub",
        type: "reach-location",
        targetId: "central-transit-hub",
        description: "Découvrir le pôle de transport",
      },
    ],
    reward: { experience: 100 },
  },
  {
    id: "neighbourhood-helper",
    title: "Un service de quartier",
    description: "Aidez le responsable de l'atelier à récupérer trois pièces de rechange.",
    prerequisites: ["first-day-nova-city"],
    contactId: "workshop-manager",
    objectives: [
      {
        id: "talk-workshop-manager",
        type: "talk-to",
        targetId: "workshop-manager",
        description: "Écouter la demande du responsable",
      },
      {
        id: "collect-spare-parts",
        type: "collect-item",
        targetId: "spare-part",
        description: "Récupérer trois pièces de rechange",
        requiredCount: 3,
      },
      {
        id: "return-to-workshop",
        type: "interact",
        targetId: "workshop-dropoff",
        description: "Déposer les pièces à l'atelier",
      },
    ],
    reward: { cash: 250, experience: 175 },
  },
];

export const NOVA_CITY_STARTER_DIALOGUES: readonly DialogueDefinition[] = [
  {
    id: "civic-coordinator-intro",
    startNodeId: "greeting",
    nodes: {
      greeting: {
        id: "greeting",
        speaker: "Coordinatrice",
        text: "Bienvenue à NOVA CITY. Le pôle de transport est le meilleur point de départ pour découvrir les quartiers.",
        choices: [
          {
            id: "accept-guidance",
            text: "Merci, je vais aller voir.",
            missionEvent: { type: "talk-to", targetId: "civic-coordinator" },
            nextNodeId: "farewell",
          },
          {
            id: "leave",
            text: "Je repasserai plus tard.",
          },
        ],
      },
      farewell: {
        id: "farewell",
        speaker: "Coordinatrice",
        text: "Bonne découverte de la ville.",
        end: true,
      },
    },
  },
];
