import type { GameFile } from "../gamefile/schema";
import { apply } from "./engine";
import type { Action, GameState } from "./types";

const MAX_UNDO = 500;

/** The Save: the current state plus every earlier one, for many-level Undo. */
export interface History {
  present: GameState;
  past: GameState[];
}

export const startHistory = (present: GameState): History => ({ present, past: [] });

/** Applies an action; a no-op action leaves History untouched so Undo never "does nothing". */
export function record(game: GameFile, history: History, action: Action): History {
  const next = apply(game, history.present, action);
  if (next === history.present) return history;
  return { present: next, past: [...history.past, history.present].slice(-MAX_UNDO) };
}

export function undo(history: History): History {
  if (!history.past.length) return history;
  return { present: history.past[history.past.length - 1], past: history.past.slice(0, -1) };
}
