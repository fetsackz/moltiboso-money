import { describe, expect, it } from "vitest";
import { gameFileSchema, type GameFile } from "../gamefile/schema";
import { apply, isBoardEmpty, maxWager, newGame, winners } from "./engine";
import { record, startHistory, undo } from "./history";
import type { Action, GameState } from "./types";

const q = (n: string, bonus = false) => ({ question: `Q ${n}`, answer: `A ${n}`, bonus });

function makeGame(): GameFile {
  return gameFileSchema.parse({
    contestants: [{ name: "Ana" }, { name: "Ben" }, { name: "Cleo" }],
    rounds: [
      {
        name: "Round 1",
        values: [100, 200],
        categories: [
          { name: "Cats", questions: [q("1a"), q("1b", true)] },
          { name: "Dogs", questions: [q("1c"), q("1d")] },
        ],
      },
      {
        name: "Round 2",
        values: [200, 400],
        categories: [{ name: "Birds", questions: [q("2a"), q("2b")] }],
      },
    ],
    final: { category: "Money", question: "F", answer: "FA" },
  });
}

const game = makeGame();
const at = 1000;
const C: Action = { type: "continue", at };

function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce((s, a) => apply(game, s, a), state);
}

/** A fresh game with Ana as Picker, past the intros, on the Round 1 Board. */
function onBoard(): GameState {
  const s = newGame(game, "test", () => 0);
  return run(s, C, C, C, C);
}

const score = (s: GameState, id: string) => s.contestants.find((c) => c.id === id)!.score;
const select = (round: number, category: number, index: number): Action => ({
  type: "select",
  ref: { round, category, index },
});

describe("show open", () => {
  it("goes title → one intro per Contestant → Board", () => {
    let s = newGame(game, "test", () => 0);
    expect(s.phase.kind).toBe("title");
    s = run(s, C);
    expect(s.phase).toEqual({ kind: "intro", index: 0 });
    s = run(s, C, C, C);
    expect(s.phase.kind).toBe("board");
  });

  it("picks the first Picker at random", () => {
    expect(newGame(game, "t", () => 0.99).picker).toBe("c2");
  });
});

describe("Continue", () => {
  it("does nothing on the Board", () => {
    const s = onBoard();
    expect(apply(game, s, C)).toBe(s);
  });

  it("does nothing while a Question is open and nobody buzzed", () => {
    const s = run(onBoard(), select(0, 0, 0));
    expect(apply(game, s, C)).toBe(s);
  });
});

describe("a regular Question", () => {
  it("correct answer scores, makes the Picker, then Continue reveals and returns", () => {
    let s = run(onBoard(), select(0, 1, 1), { type: "buzz", contestant: "c1" });
    expect(s.phase).toMatchObject({ step: "buzzed", buzzed: "c1" });
    s = run(s, { type: "judge", correct: true });
    expect(score(s, "c1")).toBe(200);
    expect(s.picker).toBe("c1");
    expect(s.phase).toMatchObject({ step: "answered", winner: "c1" });
    s = run(s, C);
    expect(s.phase).toMatchObject({ step: "answerShown" });
    s = run(s, C);
    expect(s.phase.kind).toBe("board");
  });

  it("Countdown is optional and only started by Continue", () => {
    let s = run(onBoard(), select(0, 0, 0), { type: "buzz", contestant: "c0" });
    s = run(s, { type: "continue", at: 4242 });
    expect(s.phase).toMatchObject({ step: "counting", countdownStartedAt: 4242 });
    // Continue while counting does nothing; judging still works.
    expect(apply(game, s, C)).toBe(s);
    s = run(s, { type: "judge", correct: false });
    expect(score(s, "c0")).toBe(-100);
  });

  it("wrong answer deducts, locks the Contestant out and reopens for a Steal", () => {
    let s = run(onBoard(), select(0, 0, 0), { type: "buzz", contestant: "c0" }, { type: "judge", correct: false });
    expect(score(s, "c0")).toBe(-100);
    expect(s.phase).toMatchObject({ step: "open", buzzed: null, tried: ["c0"] });
    expect(apply(game, s, { type: "buzz", contestant: "c0" })).toBe(s);
    s = run(s, { type: "buzz", contestant: "c2" }, { type: "judge", correct: true });
    expect(score(s, "c2")).toBe(100);
    expect(s.picker).toBe("c2");
  });

  it("ends when everyone has tried and failed; Picker unchanged", () => {
    const s = run(
      onBoard(),
      select(0, 0, 0),
      ...(["c0", "c1", "c2"] as const).flatMap((id): Action[] => [
        { type: "buzz", contestant: id },
        { type: "judge", correct: false },
      ]),
    );
    expect(s.phase).toMatchObject({ step: "answered", winner: null });
    expect(s.picker).toBe("c0");
  });

  it("a mis-pressed buzz key can be re-selected before judging, cancelling the Countdown", () => {
    const s = run(onBoard(), select(0, 0, 0), { type: "buzz", contestant: "c0" }, C, {
      type: "buzz",
      contestant: "c1",
    });
    expect(s.phase).toMatchObject({ step: "buzzed", buzzed: "c1", countdownStartedAt: null });
  });

  it("N (nobody) ends an open Question without changing scores", () => {
    const s = run(onBoard(), select(0, 0, 0), { type: "nobody" });
    expect(s.phase).toMatchObject({ step: "answered", winner: null });
    expect(s.contestants.every((c) => c.score === 0)).toBe(true);
  });

  it("judging needs a buzzed Contestant", () => {
    const s = run(onBoard(), select(0, 0, 0));
    expect(apply(game, s, { type: "judge", correct: true })).toBe(s);
  });

  it("a played Question cannot be picked again", () => {
    const s = run(onBoard(), select(0, 0, 0), { type: "nobody" }, C, C);
    expect(apply(game, s, select(0, 0, 0))).toBe(s);
  });
});

describe("Bonus Question", () => {
  it("needs a valid wager, then only the Picker answers for ± wager", () => {
    let s = run(onBoard(), select(0, 0, 1));
    expect(s.phase).toMatchObject({ kind: "bonusReveal", wager: null });
    expect(apply(game, s, C)).toBe(s);
    // Ana has 0, so the Wager Floor (1000) is her limit.
    s = run(s, { type: "setWager", contestant: "c0", amount: 1500 });
    expect(apply(game, s, C)).toBe(s);
    s = run(s, { type: "setWager", contestant: "c0", amount: 800 }, C);
    expect(s.phase).toMatchObject({ kind: "question", step: "buzzed", buzzed: "c0", wager: 800 });
    // No Steal: other buzz keys and N do nothing.
    expect(apply(game, s, { type: "buzz", contestant: "c1" })).toBe(s);
    s = run(s, { type: "judge", correct: false });
    expect(score(s, "c0")).toBe(-800);
    expect(s.phase).toMatchObject({ step: "answered" });
  });

  it("only the Picker's wager can be set", () => {
    const s = run(onBoard(), select(0, 0, 1));
    expect(apply(game, s, { type: "setWager", contestant: "c1", amount: 100 })).toBe(s);
  });
});

describe("wager limits", () => {
  it("allow up to the larger of score and Wager Floor", () => {
    expect(maxWager(game, -400)).toBe(1000);
    expect(maxWager(game, 200)).toBe(1000);
    expect(maxWager(game, 3000)).toBe(3000);
  });
});

function clearBoard(s: GameState): GameState {
  const round = game.rounds[s.round];
  for (let c = 0; c < round.categories.length; c++) {
    for (let i = 0; i < round.values.length; i++) {
      if (s.phase.kind !== "board") break;
      s = run(s, select(s.round, c, i));
      if (s.phase.kind === "bonusReveal") s = run(s, { type: "setWager", contestant: s.picker!, amount: 0 }, C);
      s = run(s, { type: "buzz", contestant: "c0" });
      s = s.phase.kind === "question" && s.phase.step === "buzzed" ? run(s, { type: "judge", correct: true }) : s;
      s = run(s, C, C);
    }
  }
  return s;
}

describe("Rounds", () => {
  it("end only when the Board is empty, then move to Round 2, then the Final", () => {
    let s = clearBoard(onBoard());
    expect(isBoardEmpty(game, s)).toBe(true);
    expect(s.phase.kind).toBe("roundEnd");
    s = run(s, C);
    expect(s.round).toBe(1);
    expect(s.phase.kind).toBe("board");
    s = clearBoard(s);
    expect(s.phase.kind).toBe("roundEnd");
    s = run(s, C);
    expect(s.phase).toMatchObject({ kind: "final", step: "category" });
  });
});

describe("Final Wager", () => {
  function atFinal(): GameState {
    let s = run(clearBoard(onBoard()), C);
    s = run(clearBoard(s), C);
    // Ana 1000 (400 in Round 1 with a 0 Bonus wager, 600 in Round 2); spread the others.
    return run(
      s,
      { type: "adjustScore", contestant: "c1", delta: -300 },
      { type: "adjustScore", contestant: "c2", delta: 500 },
    );
  }

  it("needs every wager (within limits) before the question, every verdict before the reveal", () => {
    let s = atFinal();
    expect(score(s, "c1")).toBe(-300);
    s = run(
      s,
      { type: "setWager", contestant: "c0", amount: 100 },
      { type: "setWager", contestant: "c1", amount: 1000 },
    );
    expect(apply(game, s, C)).toBe(s);
    s = run(s, { type: "setWager", contestant: "c2", amount: 500 }, C);
    expect(s.phase).toMatchObject({ step: "question" });
    s = run(s, { type: "judgeFinal", contestant: "c0", correct: true });
    expect(apply(game, s, C)).toBe(s);
  });

  it("reveals lowest score first in three Continue steps each, then the winner", () => {
    let s = atFinal();
    s = run(
      s,
      { type: "setWager", contestant: "c0", amount: 0 },
      { type: "setWager", contestant: "c1", amount: 1000 },
      { type: "setWager", contestant: "c2", amount: 500 },
      C,
      { type: "judgeFinal", contestant: "c0", correct: false },
      { type: "judgeFinal", contestant: "c1", correct: true },
      { type: "judgeFinal", contestant: "c2", correct: true },
      C,
    );
    const phase = s.phase;
    if (phase.kind !== "final") throw new Error("not final");
    expect(phase.order).toEqual(["c1", "c2", "c0"]);
    expect(phase).toMatchObject({ step: "reveal", revealIndex: 0, revealStep: "spotlight" });
    s = run(s, C);
    expect(s.phase).toMatchObject({ revealStep: "verdict" });
    expect(score(s, "c1")).toBe(-300);
    s = run(s, C);
    expect(s.phase).toMatchObject({ revealStep: "score" });
    expect(score(s, "c1")).toBe(700);
    s = run(s, C, C, C, C, C, C, C);
    expect(s.phase).toMatchObject({ step: "winner" });
    expect(score(s, "c0")).toBe(1000);
    expect(score(s, "c2")).toBe(1000);
    expect(winners(s).map((c) => c.id)).toEqual(["c0", "c2"]);
  });
});

describe("Contestants", () => {
  it("can be added mid-game at 0", () => {
    const s = run(onBoard(), { type: "addContestant", name: "  Dana " });
    expect(s.contestants.at(-1)).toEqual({ id: "c3", name: "Dana", photo: undefined, score: 0 });
  });
});

describe("Undo", () => {
  it("walks back every step, many levels", () => {
    let h = startHistory(onBoard());
    const start = h.present;
    for (const a of [
      select(0, 0, 0),
      { type: "buzz", contestant: "c0" },
      { type: "judge", correct: true },
      C,
    ] as Action[]) {
      h = record(game, h, a);
    }
    expect(h.past).toHaveLength(4);
    expect(score(h.present, "c0")).toBe(100);
    h = undo(undo(h));
    expect(h.present.phase).toMatchObject({ step: "buzzed" });
    expect(score(h.present, "c0")).toBe(0);
    h = undo(undo(h));
    expect(h.present).toBe(start);
    expect(undo(h)).toBe(h);
  });

  it("ignores actions that change nothing", () => {
    const h = startHistory(onBoard());
    expect(record(game, h, C)).toBe(h);
  });
});
