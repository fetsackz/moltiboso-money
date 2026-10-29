import type { GameFile } from "../gamefile/schema";
import type { Action, Contestant, ContestantId, FinalPhase, GameState, QuestionPhase, QuestionRef } from "./types";

export const refKey = (ref: QuestionRef) => `${ref.round}-${ref.category}-${ref.index}`;

export function questionAt(game: GameFile, ref: QuestionRef) {
  return game.rounds[ref.round]?.categories[ref.category]?.questions[ref.index];
}

export function valueAt(game: GameFile, ref: QuestionRef): number {
  return game.rounds[ref.round]?.values[ref.index] ?? 0;
}

/** A Contestant may always wager up to the larger of their score and the Wager Floor. */
export function maxWager(game: GameFile, score: number): number {
  return Math.max(score, game.wagerFloor);
}

export function isValidWager(game: GameFile, score: number, wager: number | null): wager is number {
  return wager !== null && Number.isInteger(wager) && wager >= 0 && wager <= maxWager(game, score);
}

export function isBoardEmpty(game: GameFile, state: GameState): boolean {
  const round = game.rounds[state.round];
  if (!round) return true;
  return round.categories.every((cat, category) =>
    cat.questions.every((_, index) => state.played.includes(refKey({ round: state.round, category, index }))),
  );
}

/** Contestants with the highest score; several on a tie. */
export function winners(state: GameState): Contestant[] {
  const top = Math.max(...state.contestants.map((c) => c.score));
  return state.contestants.filter((c) => c.score === top);
}

export function newGame(game: GameFile, gameId: string, random: () => number = Math.random): GameState {
  const contestants = game.contestants.map((c, i) => ({ id: `c${i}`, name: c.name, photo: c.photo, score: 0 }));
  return {
    gameId,
    contestants,
    nextContestantNo: contestants.length,
    round: 0,
    played: [],
    picker: contestants[Math.floor(random() * contestants.length)]?.id ?? null,
    phase: { kind: "title" },
  };
}

/**
 * Apply one Host action. Returns the same state object when the action is not
 * allowed right now, so callers can ignore it (e.g. Continue on the Board).
 */
export function apply(game: GameFile, state: GameState, action: Action): GameState {
  switch (action.type) {
    case "continue":
      return onContinue(game, state, action.at);
    case "select":
      return onSelect(game, state, action.ref);
    case "buzz":
      return onBuzz(state, action.contestant);
    case "judge":
      return onJudge(game, state, action.correct);
    case "nobody":
      return onNobody(state);
    case "setWager":
      return onSetWager(state, action.contestant, action.amount);
    case "judgeFinal":
      return onJudgeFinal(state, action.contestant, action.correct);
    case "adjustScore":
      return action.delta === 0 ? state : addScore(state, action.contestant, action.delta);
    case "addContestant":
      return onAddContestant(state, action.name, action.photo);
  }
}

function addScore(state: GameState, id: ContestantId, delta: number): GameState {
  return {
    ...state,
    contestants: state.contestants.map((c) => (c.id === id ? { ...c, score: c.score + delta } : c)),
  };
}

function scoreOf(state: GameState, id: ContestantId): number {
  return state.contestants.find((c) => c.id === id)?.score ?? 0;
}

function onContinue(game: GameFile, state: GameState, at: number): GameState {
  const phase = state.phase;
  switch (phase.kind) {
    case "title":
      return { ...state, phase: state.contestants.length ? { kind: "intro", index: 0 } : { kind: "board" } };
    case "intro":
      return {
        ...state,
        phase:
          phase.index + 1 < state.contestants.length ? { kind: "intro", index: phase.index + 1 } : { kind: "board" },
      };
    case "board":
      return state;
    case "bonusReveal": {
      if (!state.picker || !isValidWager(game, scoreOf(state, state.picker), phase.wager)) return state;
      return {
        ...state,
        phase: { ...openQuestion(phase.ref), step: "buzzed", buzzed: state.picker, wager: phase.wager },
      };
    }
    case "question":
      switch (phase.step) {
        case "buzzed":
          return { ...state, phase: { ...phase, step: "counting", countdownStartedAt: at } };
        case "answered":
          return { ...state, phase: { ...phase, step: "answerShown" } };
        case "answerShown":
          return { ...state, phase: isBoardEmpty(game, state) ? { kind: "roundEnd" } : { kind: "board" } };
        default:
          return state;
      }
    case "roundEnd":
      if (state.round + 1 < game.rounds.length) {
        return { ...state, round: state.round + 1, phase: { kind: "board" } };
      }
      return { ...state, phase: startFinal(state) };
    case "final":
      return continueFinal(game, state, phase);
  }
}

function openQuestion(ref: QuestionRef): QuestionPhase {
  return {
    kind: "question",
    ref,
    step: "open",
    buzzed: null,
    tried: [],
    wager: null,
    countdownStartedAt: null,
    winner: null,
  };
}

function onSelect(game: GameFile, state: GameState, ref: QuestionRef): GameState {
  if (state.phase.kind !== "board" || ref.round !== state.round) return state;
  const question = questionAt(game, ref);
  if (!question || state.played.includes(refKey(ref))) return state;
  const played = [...state.played, refKey(ref)];
  if (question.bonus && state.picker) {
    return { ...state, played, phase: { kind: "bonusReveal", ref, wager: null } };
  }
  return { ...state, played, phase: openQuestion(ref) };
}

function onBuzz(state: GameState, id: ContestantId): GameState {
  const phase = state.phase;
  if (phase.kind !== "question" || phase.wager !== null) return state;
  if (!["open", "buzzed", "counting"].includes(phase.step)) return state;
  if (phase.tried.includes(id) || !state.contestants.some((c) => c.id === id)) return state;
  // Re-selecting (a mis-pressed key) restarts from "buzzed" without a running Countdown.
  return { ...state, phase: { ...phase, step: "buzzed", buzzed: id, countdownStartedAt: null } };
}

function onJudge(game: GameFile, state: GameState, correct: boolean): GameState {
  const phase = state.phase;
  if (phase.kind !== "question" || !phase.buzzed) return state;
  if (phase.step !== "buzzed" && phase.step !== "counting") return state;
  const id = phase.buzzed;
  const isBonus = phase.wager !== null;
  const amount = isBonus ? phase.wager! : valueAt(game, phase.ref);
  const scored = addScore(state, id, correct ? amount : -amount);

  if (correct) {
    return {
      ...scored,
      picker: id,
      phase: { ...phase, step: "answered", winner: id, countdownStartedAt: null },
    };
  }
  const tried = [...phase.tried, id];
  const everyoneTried = isBonus || state.contestants.every((c) => tried.includes(c.id));
  return {
    ...scored,
    phase: {
      ...phase,
      step: everyoneTried ? "answered" : "open",
      buzzed: null,
      tried,
      countdownStartedAt: null,
    },
  };
}

function onNobody(state: GameState): GameState {
  const phase = state.phase;
  if (phase.kind !== "question" || phase.step !== "open") return state;
  return { ...state, phase: { ...phase, step: "answered" } };
}

function onSetWager(state: GameState, id: ContestantId, amount: number | null): GameState {
  const phase = state.phase;
  if (phase.kind === "bonusReveal" && id === state.picker) {
    return { ...state, phase: { ...phase, wager: amount } };
  }
  if (phase.kind === "final" && (phase.step === "category" || phase.step === "question")) {
    return { ...state, phase: { ...phase, wagers: { ...phase.wagers, [id]: amount } } };
  }
  return state;
}

function onJudgeFinal(state: GameState, id: ContestantId, correct: boolean | null): GameState {
  const phase = state.phase;
  if (phase.kind !== "final" || phase.step !== "question") return state;
  return { ...state, phase: { ...phase, verdicts: { ...phase.verdicts, [id]: correct } } };
}

function onAddContestant(state: GameState, name: string, photo?: string): GameState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const id = `c${state.nextContestantNo}`;
  let phase = state.phase;
  if (phase.kind === "final") {
    phase = {
      ...phase,
      wagers: { ...phase.wagers, [id]: null },
      verdicts: { ...phase.verdicts, [id]: null },
    };
  }
  return {
    ...state,
    contestants: [...state.contestants, { id, name: trimmed, photo, score: 0 }],
    nextContestantNo: state.nextContestantNo + 1,
    phase,
  };
}

function startFinal(state: GameState): FinalPhase {
  const blank = Object.fromEntries(state.contestants.map((c) => [c.id, null]));
  return {
    kind: "final",
    step: "category",
    wagers: { ...blank },
    verdicts: { ...blank },
    order: [],
    revealIndex: 0,
    revealStep: "spotlight",
  };
}

function continueFinal(game: GameFile, state: GameState, phase: FinalPhase): GameState {
  const ids = state.contestants.map((c) => c.id);
  switch (phase.step) {
    case "category": {
      const allWagered = ids.every((id) => isValidWager(game, scoreOf(state, id), phase.wagers[id] ?? null));
      return allWagered ? { ...state, phase: { ...phase, step: "question" } } : state;
    }
    case "question": {
      if (!ids.every((id) => typeof phase.verdicts[id] === "boolean")) return state;
      // Lowest score first so the leader is revealed last; stable for ties.
      const order = [...state.contestants].sort((a, b) => a.score - b.score).map((c) => c.id);
      return { ...state, phase: { ...phase, step: "reveal", order, revealIndex: 0, revealStep: "spotlight" } };
    }
    case "reveal": {
      const id = phase.order[phase.revealIndex];
      if (phase.revealStep === "spotlight") return { ...state, phase: { ...phase, revealStep: "verdict" } };
      if (phase.revealStep === "verdict") {
        const wager = phase.wagers[id] ?? 0;
        return {
          ...addScore(state, id, phase.verdicts[id] ? wager : -wager),
          phase: { ...phase, revealStep: "score" },
        };
      }
      const next = phase.revealIndex + 1;
      return next < phase.order.length
        ? { ...state, phase: { ...phase, revealIndex: next, revealStep: "spotlight" } }
        : { ...state, phase: { ...phase, step: "winner" } };
    }
    case "winner":
      return state;
  }
}
