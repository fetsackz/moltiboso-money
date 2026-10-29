import { questionAt, valueAt } from "../engine/engine";
import type { GameState, QuestionPhase } from "../engine/types";
import { mediaUrl } from "../gamefile/library";
import type { GameFile } from "../gamefile/schema";
import { formatPoints } from "../format";
import { Avatar, CountdownRing } from "./Podiums";

export type Flash = { kind: "correct" | "wrong"; id: number } | null;

/** Font size that keeps long questions on the card. */
export const questionSize = (text: string, hasMedia: boolean) => {
  const base = hasMedia ? 0.8 : 1;
  if (text.length > 180) return 46 * base;
  if (text.length > 110) return 56 * base;
  return 68 * base;
};

export function QuestionView({
  game,
  state,
  phase,
  countdown,
  audioPlaying,
  flash,
}: {
  game: GameFile;
  state: GameState;
  phase: QuestionPhase;
  countdown: number | null;
  audioPlaying: boolean;
  flash: Flash;
}) {
  const q = questionAt(game, phase.ref);
  const round = game.rounds[phase.ref.round];
  if (!q || !round) return null;
  const isBonus = phase.wager !== null;
  const buzzed = state.contestants.find((c) => c.id === phase.buzzed);
  const image = mediaUrl(q.image);
  const revealed = phase.step === "answerShown";
  // Zoom out of the tile's position on the Board.
  const origin = `${((phase.ref.category + 0.5) / round.categories.length) * 100}% ${
    ((phase.ref.index + 1.5) / (round.values.length + 1)) * 100
  }%`;

  return (
    <div className="question-wrap">
      <div className={`question-card ${isBonus ? "bonus" : ""}`} style={{ transformOrigin: origin }}>
        {flash && <div className={`flash-overlay ${flash.kind}`} key={flash.id} />}
        <div className={`question-shaker ${flash?.kind === "wrong" ? "shake" : ""}`} key={`s${flash?.id ?? 0}`}>
          <div className="question-top">
            <span className="question-cat">{round.categories[phase.ref.category].name}</span>
            <span className="question-value">
              {isBonus ? (
                <>
                  <b>BONUS</b> · wager {formatPoints(phase.wager!)}
                </>
              ) : (
                formatPoints(valueAt(game, phase.ref))
              )}
            </span>
          </div>

          <div className={`question-body ${image ? "with-image" : ""}`}>
            <p className="question-text" style={{ fontSize: questionSize(q.question, !!image) }}>
              {q.question}
            </p>
            {image && <img className="question-image" src={image} alt="" />}
            {q.audio && <AudioBars playing={audioPlaying} />}
          </div>

          <div className={`answer-plaque ${revealed ? "shown" : ""}`}>
            <span className="answer-label">Answer</span>
            <span className="answer-text">{q.answer}</span>
          </div>

          {buzzed && (
            <div className="buzz-chip" key={buzzed.id}>
              <div className="buzz-avatar">
                <Avatar contestant={buzzed} size={110} />
                {countdown != null && <CountdownRing fraction={countdown} size={136} />}
              </div>
              <div className="buzz-name">{buzzed.name}</div>
              {countdown != null && (
                <div className={`buzz-seconds ${countdown <= 0 ? "expired" : ""}`}>
                  {countdown <= 0 ? "TIME" : Math.ceil(countdown * game.countdownSeconds)}
                </div>
              )}
            </div>
          )}
        </div>
        {flash?.kind === "wrong" && (
          <div className="stamp wrong" key={`x${flash.id}`}>
            ✗
          </div>
        )}
      </div>
    </div>
  );
}

export function AudioBars({ playing }: { playing: boolean }) {
  return (
    <div className={`audio-bars ${playing ? "playing" : ""}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} style={{ animationDelay: `${(i * 137) % 600}ms` }} />
      ))}
      <em>{playing ? "Listen…" : "♪ Audio question"}</em>
    </div>
  );
}
