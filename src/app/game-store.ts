import { create } from "zustand";

export type GamePhase = "menu" | "playing" | "paused";

interface GameUIState {
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;
  togglePause: () => void;
}

export const useGameStore = create<GameUIState>((set, get) => ({
  phase: "menu",
  setPhase: (phase) => set({ phase }),
  togglePause: () => {
    const phase = get().phase;
    if (phase === "playing") set({ phase: "paused" });
    else if (phase === "paused") set({ phase: "playing" });
  },
}));
