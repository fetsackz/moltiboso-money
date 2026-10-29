import type { GameState } from "../engine/types";

/** Why the state changed; the Stage only animates "action". */
export type Cause = "action" | "undo" | "load";

export type Message =
  | { type: "state"; state: GameState | null; cause: Cause }
  | { type: "hello" }
  /** The Host Console plays Question audio itself; the Stage only animates it. */
  | { type: "audio"; playing: boolean };

const channel = new BroadcastChannel("moltiboso-money");

export function send(message: Message) {
  channel.postMessage(message);
}

export function listen(handler: (message: Message) => void): () => void {
  const onMessage = (e: MessageEvent<Message>) => handler(e.data);
  channel.addEventListener("message", onMessage);
  return () => channel.removeEventListener("message", onMessage);
}
