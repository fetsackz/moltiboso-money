import { winners } from "../engine/engine";
import type { Contestant, FinalPhase, GameState, QuestionRef } from "../engine/types";
import { mediaUrl } from "../gamefile/library";
import type { GameFile } from "../gamefile/schema";
import { formatPoints } from "../format";
import { Avatar, Score } from "./Podiums";
import { AudioBars, questionSize } from "./QuestionView";

export function Title({ title, contestants }: { title: string; contestants: Contestant[] }) {
  const [first, ...rest] = title.split(" ");
  return (
    <div className="screen title-screen">
      <div className="title-rays" />
      <div className="title-kicker">Live from the sofa</div>
      <h1 className="title-logo foil">
        <span>{first}</span>
        {rest.length > 0 && <span>{rest.join(" ")}</span>}
      </h1>
      <div className="title-rule" />
      {contestants.length > 0 ? (
        <div className="title-cast">
          {contestants.map((c, i) => (
            <div key={c.id} className="title-cast-member" style={{ animationDelay: `${600 + i * 120}ms` }}>
              <Avatar contestant={c} size={110} />
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="title-wait">Waiting for the Host…</div>
      )}
    </div>
  );
}

export function Intro({ contestant, index, total }: { contestant: Contestant; index: number; total: number }) {
  return (
    <div className="screen intro-screen" key={contestant.id}>
      <div className="intro-light" />
      <div className="intro-kicker">
        Contestant {index + 1} of {total}
      </div>
      <div className="intro-avatar">
        <Avatar contestant={contestant} size={340} />
      </div>
      <h2 className="intro-name foil">{contestant.name}</h2>
    </div>
  );
}

export function BonusReveal({ game, qref, picker }: { game: GameFile; qref: QuestionRef; picker?: Contestant }) {
  const category = game.rounds[qref.round]?.categories[qref.category]?.name;
  return (
    <div className="screen bonus-screen">
      <div className="bonus-rays" />
      <div className="bonus-word foil">BONUS</div>
      <div className="bonus-sub">
        {picker && (
          <>
            <b>{picker.name}</b> plays alone. Place your wager!
          </>
        )}
      </div>
      <div className="bonus-cat">{category}</div>
    </div>
  );
}

export function RoundEnd({ game, state }: { game: GameFile; state: GameState }) {
  const standings = [...state.contestants].sort((a, b) => b.score - a.score);
  const next = game.rounds[state.round + 1];
  return (
    <div className="screen round-end-screen">
      <div className="kicker">End of {game.rounds[state.round]?.name}</div>
      <h2 className="foil big-heading">Standings</h2>
      <ol className="standings">
        {standings.map((c, i) => (
          <li key={c.id} style={{ animationDelay: `${200 + i * 150}ms` }}>
            <span className="standings-rank">{i + 1}</span>
            <Avatar contestant={c} size={72} />
            <span className="standings-name">{c.name}</span>
            <Score value={c.score} animate={false} />
          </li>
        ))}
      </ol>
      <div className="up-next">
        Up next: <b>{next ? `${next.name}: values doubled!` : "The Final Wager"}</b>
      </div>
    </div>
  );
}

export function Final({
  game,
  state,
  phase,
  animate,
  audioPlaying,
}: {
  game: GameFile;
  state: GameState;
  phase: FinalPhase;
  animate: boolean;
  audioPlaying: boolean;
}) {
  if (phase.step === "category") {
    return (
      <div className="screen final-screen">
        <div className="title-rays slow" />
        <div className="kicker">The Final Wager</div>
        <h2 className="final-cat foil">{game.final.category}</h2>
        <div className="final-sub">Place your wagers. Up to your score, or {formatPoints(game.wagerFloor)}.</div>
      </div>
    );
  }
  if (phase.step === "question") {
    const image = mediaUrl(game.final.image);
    return (
      <div className="question-wrap">
        <div className="question-card final-card">
          <div className="question-top">
            <span className="question-cat">{game.final.category}</span>
            <span className="question-value">
              <b>FINAL WAGER</b>
            </span>
          </div>
          <div className={`question-body ${image ? "with-image" : ""}`}>
            <p className="question-text" style={{ fontSize: questionSize(game.final.question, !!image) }}>
              {game.final.question}
            </p>
            {image && <img className="question-image" src={image} alt="" />}
            {game.final.audio && <AudioBars playing={audioPlaying} />}
          </div>
          <div className="final-write">Write down your answer…</div>
        </div>
      </div>
    );
  }
  if (phase.step === "reveal") {
    const id = phase.order[phase.revealIndex];
    const c = state.contestants.find((x) => x.id === id);
    if (!c) return null;
    const verdict = phase.verdicts[id];
    const shownVerdict = phase.revealStep !== "spotlight";
    const shownScore = phase.revealStep === "score";
    const answerKnown = phase.revealIndex > 0 || shownVerdict;
    return (
      <div className="screen reveal-screen">
        <div className="spotlight-beam" key={id} />
        <div className={`reveal-answer ${answerKnown ? "shown" : ""}`}>
          The answer: <b>{game.final.answer}</b>
        </div>
        <div className="reveal-card" key={`card-${id}`}>
          <Avatar contestant={c} size={260} />
          <div className="reveal-name foil">{c.name}</div>
          <div className="reveal-score">
            <Score value={c.score} animate={animate} />
          </div>
          <div className={`reveal-wager ${shownScore ? "shown" : ""}`}>
            Wagered <b>{formatPoints(phase.wagers[id] ?? 0)}</b>
          </div>
          {shownVerdict && (
            <div className={`stamp big ${verdict ? "right" : "wrong"}`}>{verdict ? "CORRECT" : "WRONG"}</div>
          )}
        </div>
      </div>
    );
  }
  return <Winner state={state} />;
}

export function Winner({ state }: { state: GameState }) {
  const top = winners(state);
  const rest = [...state.contestants].filter((c) => !top.includes(c)).sort((a, b) => b.score - a.score);
  return (
    <div className="screen winner-screen">
      <div className="title-rays" />
      <div className="kicker">{top.length > 1 ? "It's a tie!" : "Tonight's Mogul"}</div>
      <div className="winner-podium">
        {top.map((c) => (
          <div key={c.id} className="winner">
            <div className="winner-crown">♛</div>
            <Avatar contestant={c} size={280} />
            <div className="winner-name foil">{c.name}</div>
            <Score value={c.score} animate={false} className="winner-score" />
          </div>
        ))}
      </div>
      <div className="winner-rest">
        {rest.map((c) => (
          <span key={c.id}>
            {c.name} <Score value={c.score} animate={false} />
          </span>
        ))}
      </div>
    </div>
  );
}
