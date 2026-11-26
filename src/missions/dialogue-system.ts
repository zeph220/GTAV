import type { EntityId } from "../shared/types";
import type { MissionEvent } from "./mission-types";

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId?: string;
  /** Optional gameplay event, for example completing a talk-to objective. */
  missionEvent?: MissionEvent;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices?: readonly DialogueChoice[];
  end?: boolean;
}

export interface DialogueDefinition {
  id: string;
  startNodeId: string;
  nodes: Readonly<Record<string, DialogueNode>>;
}

export interface DialogueSession {
  playerId: EntityId;
  dialogueId: string;
  currentNodeId: string;
}

export interface DialogueSystemOptions {
  onNode?: (session: DialogueSession, node: DialogueNode) => void;
  onMissionEvent?: (playerId: EntityId, event: MissionEvent) => void;
  onEnded?: (playerId: EntityId, dialogueId: string) => void;
}

/** Data-driven NPC dialogue with validated branching choices. */
export class DialogueSystem {
  private readonly definitions = new Map<string, DialogueDefinition>();
  private readonly sessions = new Map<EntityId, DialogueSession>();

  constructor(
    definitions: readonly DialogueDefinition[] = [],
    private readonly options: DialogueSystemOptions = {},
  ) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: DialogueDefinition): void {
    validateDialogue(definition);
    if (this.definitions.has(definition.id)) {
      throw new Error(`Dialogue already registered: ${definition.id}`);
    }
    this.definitions.set(definition.id, cloneDialogue(definition));
  }

  start(playerId: EntityId, dialogueId: string): DialogueNode | null {
    const definition = this.definitions.get(dialogueId);
    if (!definition) return null;
    const session: DialogueSession = {
      playerId,
      dialogueId,
      currentNodeId: definition.startNodeId,
    };
    this.sessions.set(playerId, session);
    return this.currentNode(playerId);
  }

  choose(playerId: EntityId, choiceId: string): DialogueNode | null {
    const session = this.sessions.get(playerId);
    if (!session) return null;
    const definition = this.definitions.get(session.dialogueId);
    const node = definition?.nodes[session.currentNodeId];
    const choice = node?.choices?.find((candidate) => candidate.id === choiceId);
    if (!definition || !node || !choice) return null;

    if (choice.missionEvent) this.options.onMissionEvent?.(playerId, { ...choice.missionEvent });
    if (!choice.nextNodeId) {
      this.end(playerId);
      return null;
    }
    session.currentNodeId = choice.nextNodeId;
    return this.currentNode(playerId);
  }

  currentNode(playerId: EntityId): DialogueNode | null {
    const session = this.sessions.get(playerId);
    if (!session) return null;
    const definition = this.definitions.get(session.dialogueId);
    const node = definition?.nodes[session.currentNodeId];
    if (!node) return null;
    this.options.onNode?.({ ...session }, cloneNode(node));
    return cloneNode(node);
  }

  end(playerId: EntityId): boolean {
    const session = this.sessions.get(playerId);
    if (!session) return false;
    this.sessions.delete(playerId);
    this.options.onEnded?.(playerId, session.dialogueId);
    return true;
  }

  getSession(playerId: EntityId): DialogueSession | null {
    const session = this.sessions.get(playerId);
    return session ? { ...session } : null;
  }
}

function validateDialogue(definition: DialogueDefinition): void {
  if (!definition.id.trim() || !definition.startNodeId.trim()) {
    throw new Error("Dialogue id and startNodeId are required");
  }
  if (!definition.nodes[definition.startNodeId]) {
    throw new Error(`Missing start node in dialogue ${definition.id}`);
  }
  for (const [nodeId, node] of Object.entries(definition.nodes)) {
    if (node.id !== nodeId || !node.speaker.trim() || !node.text.trim()) {
      throw new Error(`Invalid dialogue node: ${nodeId}`);
    }
    const choiceIds = new Set<string>();
    for (const choice of node.choices ?? []) {
      if (!choice.id.trim() || !choice.text.trim() || choiceIds.has(choice.id)) {
        throw new Error(`Invalid choice in dialogue node ${nodeId}`);
      }
      choiceIds.add(choice.id);
      if (choice.nextNodeId && !definition.nodes[choice.nextNodeId]) {
        throw new Error(`Unknown next dialogue node: ${choice.nextNodeId}`);
      }
    }
    if (!node.end && (!node.choices || node.choices.length === 0)) {
      throw new Error(`Dialogue node ${nodeId} needs choices or end=true`);
    }
  }
}

function cloneDialogue(definition: DialogueDefinition): DialogueDefinition {
  const nodes: Record<string, DialogueNode> = {};
  for (const [id, node] of Object.entries(definition.nodes)) nodes[id] = cloneNode(node);
  return { ...definition, nodes };
}

function cloneNode(node: DialogueNode): DialogueNode {
  return {
    ...node,
    choices: node.choices?.map((choice) => ({
      ...choice,
      missionEvent: choice.missionEvent ? { ...choice.missionEvent } : undefined,
    })),
  };
}
