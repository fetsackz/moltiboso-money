import { useSyncExternalStore } from "react";
import { parseGameFile, type ParseResult } from "./schema";
import * as initial from "./sources";

export interface GameEntry {
  /** Path under games/ without extension, e.g. "example" or "private/2026-11-07"; also the key of its Save. */
  id: string;
  /** Path under games/, e.g. "private/2026-11-07.yaml". */
  fileName: string;
  result: ParseResult;
}

let sources = { yaml: initial.yamlSources, media: initial.mediaSources };
let entries = build();
const listeners = new Set<() => void>();

function build(): GameEntry[] {
  return Object.entries(sources.yaml)
    .map(([path, raw]) => {
      const fileName = path.replace(/^\/games\//, "");
      const baseDir = fileName.includes("/") ? fileName.slice(0, fileName.lastIndexOf("/")) : "";
      return {
        id: fileName.replace(/\.ya?ml$/, ""),
        fileName,
        result: parseGameFile(raw, (p) => `/games/${p}` in sources.media, baseDir),
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

if (import.meta.hot) {
  import.meta.hot.accept("./sources", (mod) => {
    if (!mod) return;
    sources = { yaml: mod.yamlSources, media: mod.mediaSources };
    entries = build();
    listeners.forEach((l) => l());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGames(): GameEntry[] {
  return useSyncExternalStore(subscribe, () => entries);
}

export function useGame(id: string | null): GameEntry | undefined {
  return useGames().find((e) => e.id === id);
}

/** URL for a media path from a Game File (relative to games/), or undefined if missing. */
export function mediaUrl(path: string | undefined): string | undefined {
  return path ? sources.media[`/games/${path}`] : undefined;
}
