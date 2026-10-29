import { useEffect, useRef, useState } from "react";
import type { GameState } from "../engine/types";
import { listen, send, type Cause } from "../sync/channel";
import { loadActiveId, loadSave } from "../sync/save";

export const STAGE_W = 1920;
export const STAGE_H = 1080;

export interface StageView {
  state: GameState | null;
  /** The state before the latest change, for transition effects. */
  prev: GameState | null;
  cause: Cause;
}

/** The Stage only follows: it starts from the Save, then mirrors the Host Console. */
export function useStageView(): StageView {
  const [view, setView] = useState<StageView>(() => {
    const id = loadActiveId();
    return { state: (id && loadSave(id)?.present) || null, prev: null, cause: "load" };
  });
  useEffect(() => {
    const off = listen((m) => {
      if (m.type === "state") setView((v) => ({ state: m.state, prev: v.state, cause: m.cause }));
    });
    send({ type: "hello" });
    return off;
  }, []);
  return view;
}

/** Scale factor fitting the fixed 1920×1080 Stage into the window. */
export function useStageScale(): number {
  const get = () => Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
  const [scale, setScale] = useState(get);
  useEffect(() => {
    const onResize = () => setScale(get());
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);
  return scale;
}

/** Current time, refreshed every `ms` while `active`. */
export function useNow(active: boolean, ms = 100): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [active, ms]);
  return now;
}

/** A number that rolls to its new value; jumps instantly when `animate` is false. */
export function useRolling(value: number, animate: boolean, duration = 1100): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  useEffect(() => {
    if (!animate) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const from = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      shownRef.current = Math.round(from + (value - from) * eased);
      setShown(shownRef.current);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, animate, duration]);
  return shown;
}
