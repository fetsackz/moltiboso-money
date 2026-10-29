import { useEffect, useRef, useState } from "react";
import { SoundPlayer } from "../audio/player";
import { refKey } from "../engine/engine";
import type { GameState, Phase } from "../engine/types";
import { mediaUrl, useGame } from "../gamefile/library";
import { BUILTIN_SOUNDS, type GameFile } from "../gamefile/schema";
import { listen } from "../sync/channel";
import { Board } from "./Board";
import { STAGE_H, STAGE_W, useNow, useStageScale, useStageView } from "./hooks";
import { Particles, type ParticlesHandle } from "./Particles";
import { Podiums } from "./Podiums";
import { QuestionView, type Flash } from "./QuestionView";
import { BonusReveal, Final, Intro, RoundEnd, Title, Winner } from "./Screens";
import "./stage.css";

const player = new SoundPlayer();

export function Stage() {
  const view = useStageView();
  const { state, cause } = view;
  const entry = useGame(state?.gameId ?? null);
  const game = entry?.result.ok ? entry.result.game : null;
  const scale = useStageScale();
  const particles = useRef<ParticlesHandle>(null);
  const [unlocked, setUnlocked] = useState(player.unlocked);
  // If Safari suspends the sound (sleep, another app), the click-to-start overlay comes back.
  useEffect(() => player.onStateChange(() => setUnlocked(player.unlocked)), []);
  const [flash, setFlash] = useState<Flash>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const idle = useIdleCursor();
  const startedAt = state?.phase.kind === "question" ? state.phase.countdownStartedAt : null;
  const now = useNow(startedAt !== null);
  const countdown = game ? countdownFraction(startedAt, game, now) : null;

  useEffect(() => {
    if (!game) return;
    player.overrides = Object.fromEntries(
      BUILTIN_SOUNDS.flatMap((name) => {
        const url = mediaUrl(game.sounds[name]);
        return url ? [[name, url]] : [];
      }),
    );
  }, [game]);

  useTransitionEffects(view, game, particles, setFlash);
  useCountdownSounds(state, cause, game);

  // The Host Console plays Question audio itself; the Stage only shows the bars.
  useEffect(
    () =>
      listen((m) => {
        if (m.type === "audio") setAudioPlaying(m.playing);
      }),
    [],
  );
  const scene = state ? sceneKey(state) : "none";
  useEffect(() => setAudioPlaying(false), [scene]);

  // Think music runs while the Final question is up.
  const thinking = state?.phase.kind === "final" && state.phase.step === "question";
  useEffect(() => {
    if (thinking && unlocked) player.loop("think");
    else player.stopLoop("think");
  }, [thinking, unlocked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f") return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`stage-viewport ${idle ? "idle" : ""}`}>
      <div
        className="stage"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div className="velvet" />
        <div className="scene" key={scene}>
          {state && game ? (
            <Scene view={view} game={game} flash={flash} audioPlaying={audioPlaying} countdown={countdown} />
          ) : (
            <Title title={game?.title ?? "Moltiboso Money"} contestants={[]} />
          )}
        </div>
        {state && game && showPodiums(state.phase) && (
          <Podiums state={state} animate={cause === "action"} highlight={podiumHighlight(state, countdown)} />
        )}
        <Particles ref={particles} />
        {!unlocked && (
          <button
            className="unlock"
            onClick={async () => {
              await player.unlock();
              setUnlocked(player.unlocked);
            }}
          >
            <span className="foil">Click to start the show</span>
            <small>enables sound · press F for fullscreen</small>
          </button>
        )}
      </div>
    </div>
  );
}

function Scene({
  view,
  game,
  flash,
  audioPlaying,
  countdown,
}: {
  view: ReturnType<typeof useStageView>;
  game: GameFile;
  flash: Flash;
  audioPlaying: boolean;
  countdown: number | null;
}) {
  const state = view.state!;
  const p = state.phase;
  const animate = view.cause === "action";
  switch (p.kind) {
    case "title":
      return <Title title={game.title} contestants={state.contestants} />;
    case "intro": {
      const c = state.contestants[p.index];
      return c ? <Intro contestant={c} index={p.index} total={state.contestants.length} /> : null;
    }
    case "board": {
      const entering = view.cause !== "action" || !view.prev || view.prev.phase.kind !== "question";
      return <Board game={game} state={state} entering={entering} />;
    }
    case "bonusReveal":
      return <BonusReveal game={game} qref={p.ref} picker={state.contestants.find((c) => c.id === state.picker)} />;
    case "question":
      return (
        <QuestionView
          game={game}
          state={state}
          phase={p}
          countdown={countdown}
          audioPlaying={audioPlaying}
          flash={flash}
          key={refKey(p.ref)}
        />
      );
    case "roundEnd":
      return <RoundEnd game={game} state={state} />;
    case "final":
      return p.step === "winner" ? (
        <Winner state={state} />
      ) : (
        <Final game={game} state={state} phase={p} animate={animate} audioPlaying={audioPlaying} />
      );
  }
}

/** Changes of this key fade the scene in; staying on the same key keeps it mounted. */
function sceneKey(state: GameState): string {
  const p = state.phase;
  switch (p.kind) {
    case "intro":
      return `intro-${p.index}`;
    case "board":
      return `board-${state.round}`;
    case "bonusReveal":
      return `bonus-${refKey(p.ref)}`;
    case "question":
      return `question-${refKey(p.ref)}`;
    case "final":
      return p.step === "reveal" ? `final-reveal-${p.revealIndex}` : `final-${p.step}`;
    default:
      return p.kind;
  }
}

function showPodiums(phase: Phase): boolean {
  if (phase.kind === "final") return phase.step === "category" || phase.step === "question";
  return phase.kind === "board" || phase.kind === "bonusReveal" || phase.kind === "question";
}

function podiumHighlight(state: GameState, countdown: number | null) {
  const p = state.phase;
  if (p.kind !== "question") return {};
  return { buzzed: p.buzzed, tried: p.tried, countdown };
}

function countdownFraction(startedAt: number | null, game: GameFile, now: number): number | null {
  if (startedAt === null) return null;
  return Math.max(0, 1 - (now - startedAt) / (game.countdownSeconds * 1000));
}

/** Sounds and particles for what just happened. Only live actions, never reloads or Undo. */
function useTransitionEffects(
  view: ReturnType<typeof useStageView>,
  game: GameFile | null,
  particles: React.RefObject<ParticlesHandle | null>,
  setFlash: (f: Flash) => void,
) {
  useEffect(() => {
    const { state, prev, cause } = view;
    if (!state || !prev || !game || cause !== "action") return;
    const p = state.phase;
    const pp = prev.phase;
    const samePhase = JSON.stringify(p) === JSON.stringify(pp);

    for (const c of state.contestants) {
      const before = prev.contestants.find((x) => x.id === c.id)?.score;
      if (before === undefined || before === c.score) continue;
      const gained = c.score > before;
      if (p.kind === "final") {
        if (gained) {
          player.play("coins");
          particles.current?.coins(STAGE_W / 2, 560, 60);
        }
        continue;
      }
      if (samePhase) continue; // manual score adjustment: just roll the number
      player.play(gained ? "correct" : "wrong");
      if (gained) {
        player.play("coins");
        const at = podiumCenter(c.id);
        if (at) particles.current?.coins(at.x, at.y, 45);
      }
      setFlash({ kind: gained ? "correct" : "wrong", id: Date.now() });
    }

    if (p.kind === "intro" || (p.kind === "board" && pp.kind !== "board" && pp.kind !== "question")) {
      player.play("reveal");
    } else if (p.kind === "question" && pp.kind === "board") {
      player.play("reveal");
    } else if (
      p.kind === "question" &&
      p.step === "answerShown" &&
      pp.kind === "question" &&
      pp.step !== "answerShown"
    ) {
      player.play("reveal");
    } else if (p.kind === "bonusReveal" && pp.kind !== "bonusReveal") {
      player.play("bonus");
    } else if (p.kind === "roundEnd") {
      player.play("drumroll");
    } else if (p.kind === "final") {
      const fp = pp.kind === "final" ? pp : null;
      if (p.step === "category" && !fp) player.play("bonus");
      if (p.step === "reveal" && (fp?.revealStep !== p.revealStep || fp.revealIndex !== p.revealIndex)) {
        if (p.revealStep === "spotlight") player.play("drumroll");
        if (p.revealStep === "verdict") player.play(p.verdicts[p.order[p.revealIndex]] ? "correct" : "wrong");
      }
      if (p.step === "winner" && fp?.step !== "winner") {
        player.play("win");
        particles.current?.confetti(8);
      }
    }
  }, [view, game, particles, setFlash]);
}

function podiumCenter(id: string) {
  const stage = document.querySelector(".stage");
  const el = document.querySelector(`[data-podium="${id}"] .podium-avatar`);
  if (!stage || !el) return null;
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const k = s.width / STAGE_W;
  return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
}

/** Countdown ticks each second and a time's-up sound, only for a Countdown started just now. */
function useCountdownSounds(state: GameState | null, cause: string, game: GameFile | null) {
  const p = state?.phase;
  const startedAt = p?.kind === "question" && p.step === "counting" ? p.countdownStartedAt : null;
  const seconds = game?.countdownSeconds ?? 5;
  useEffect(() => {
    if (startedAt === null || cause !== "action" || Date.now() - startedAt > 1500) return;
    const offset = Date.now() - startedAt;
    const timers = [
      ...Array.from({ length: Math.floor(seconds) }, (_, s) =>
        setTimeout(() => player.play("tick"), s * 1000 - offset),
      ),
      setTimeout(() => player.play("timeUp"), seconds * 1000 - offset),
    ];
    return () => timers.forEach(clearTimeout);
  }, [startedAt, cause, seconds]);
}

/** Hide the mouse cursor on the TV after a moment of no movement. */
function useIdleCursor(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), 2500);
    const onMove = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 2500);
    };
    addEventListener("mousemove", onMove);
    return () => {
      clearTimeout(timer);
      removeEventListener("mousemove", onMove);
    };
  }, []);
  return idle;
}
