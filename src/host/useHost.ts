import { useCallback, useEffect, useRef, useState } from "react";
import { newGame } from "../engine/engine";
import { record, startHistory, undo as undoHistory, type History } from "../engine/history";
import type { Action } from "../engine/types";
import { useGames } from "../gamefile/library";
import { listen, send, type Cause } from "../sync/channel";
import { loadActiveId, loadSave, storeActiveId, storeSave } from "../sync/save";

/** The Host Console owns the game: it applies actions, saves, and broadcasts to the Stage. */
export function useHost() {
  const games = useGames();
  const [history, setHistory] = useState<History | null>(() => {
    const id = loadActiveId();
    return id ? loadSave(id) : null;
  });
  const ref = useRef(history);
  ref.current = history;

  const entry = games.find((g) => g.id === history?.present.gameId);
  const game = entry?.result.ok ? entry.result.game : null;
  const gameRef = useRef(game);
  gameRef.current = game;

  const commit = useCallback((next: History, cause: Cause) => {
    ref.current = next;
    setHistory(next);
    storeSave(next);
    storeActiveId(next.present.gameId);
    send({ type: "state", state: next.present, cause });
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      const current = ref.current;
      if (!current || !gameRef.current) return;
      const next = record(gameRef.current, current, action);
      if (next !== current) commit(next, "action");
    },
    [commit],
  );

  const undo = useCallback(() => {
    const current = ref.current;
    if (!current) return;
    const next = undoHistory(current);
    if (next !== current) commit(next, "undo");
  }, [commit]);

  const startNew = useCallback(
    (gameId: string) => {
      const target = games.find((g) => g.id === gameId);
      if (!target?.result.ok) return;
      commit(startHistory(newGame(target.result.game, gameId)), "load");
    },
    [games, commit],
  );

  const resume = useCallback(
    (gameId: string) => {
      const saved = loadSave(gameId);
      if (saved) commit(saved, "load");
    },
    [commit],
  );

  // A freshly opened Stage asks for the current state.
  useEffect(
    () =>
      listen((m) => {
        if (m.type === "hello") send({ type: "state", state: ref.current?.present ?? null, cause: "load" });
      }),
    [],
  );

  return { games, history, state: history?.present ?? null, game, dispatch, undo, startNew, resume };
}
