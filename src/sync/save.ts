import type { History } from "../engine/history";

const ACTIVE_KEY = "mm:active";
const saveKey = (gameId: string) => `mm:save:${gameId}`;

export function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function storeActiveId(gameId: string) {
  localStorage.setItem(ACTIVE_KEY, gameId);
}

export function loadSave(gameId: string): History | null {
  try {
    const raw = localStorage.getItem(saveKey(gameId));
    return raw ? (JSON.parse(raw) as History) : null;
  } catch {
    return null;
  }
}

export function storeSave(history: History) {
  // If storage is full, keep the game going with a shorter Undo history.
  for (let past = history.past; ; past = past.slice(Math.floor(past.length / 2))) {
    try {
      localStorage.setItem(saveKey(history.present.gameId), JSON.stringify({ ...history, past }));
      return;
    } catch (e) {
      if (!past.length) throw e;
    }
  }
}

export function hasSave(gameId: string): boolean {
  return localStorage.getItem(saveKey(gameId)) !== null;
}
