// A Question is referenced by its position in the Game File, never by its content,
// so the Host can fix typos in the Game File mid-game.
export interface QuestionRef {
  round: number;
  category: number;
  index: number;
}

export type ContestantId = string;

export interface Contestant {
  id: ContestantId;
  name: string;
  photo?: string;
  score: number;
}

export type QuestionStep = "open" | "buzzed" | "counting" | "answered" | "answerShown";

export interface QuestionPhase {
  kind: "question";
  ref: QuestionRef;
  step: QuestionStep;
  /** Contestant currently answering (buzzed / counting). */
  buzzed: ContestantId | null;
  /** Contestants who answered wrong and may not Steal. */
  tried: ContestantId[];
  /** Set for a Bonus Question: the Picker's wager replaces the value. */
  wager: number | null;
  countdownStartedAt: number | null;
  /** Who answered correctly, once the step is "answered". */
  winner: ContestantId | null;
}

export type FinalStep = "category" | "question" | "reveal" | "winner";
export type RevealStep = "spotlight" | "verdict" | "score";

export interface FinalPhase {
  kind: "final";
  step: FinalStep;
  wagers: Record<ContestantId, number | null>;
  verdicts: Record<ContestantId, boolean | null>;
  /** Reveal order, lowest score first; fixed when the reveal starts. */
  order: ContestantId[];
  revealIndex: number;
  revealStep: RevealStep;
}

export type Phase =
  | { kind: "title" }
  | { kind: "intro"; index: number }
  | { kind: "board" }
  | { kind: "bonusReveal"; ref: QuestionRef; wager: number | null }
  | QuestionPhase
  | { kind: "roundEnd" }
  | FinalPhase;

export interface GameState {
  gameId: string;
  contestants: Contestant[];
  nextContestantNo: number;
  round: number;
  /** Keys from refKey() of every Question already picked. */
  played: string[];
  picker: ContestantId | null;
  phase: Phase;
}

export type Action =
  | { type: "continue"; at: number }
  | { type: "select"; ref: QuestionRef }
  | { type: "buzz"; contestant: ContestantId }
  | { type: "judge"; correct: boolean }
  | { type: "nobody" }
  | { type: "setWager"; contestant: ContestantId; amount: number | null }
  | { type: "judgeFinal"; contestant: ContestantId; correct: boolean | null }
  | { type: "adjustScore"; contestant: ContestantId; delta: number }
  | { type: "addContestant"; name: string; photo?: string };
