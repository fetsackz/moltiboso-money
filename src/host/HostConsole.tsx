import { useEffect, useRef, useState } from "react";
import { playClip } from "../audio/clip";
import { isBoardEmpty, isValidWager, maxWager, questionAt, refKey, valueAt } from "../engine/engine";
import type { GameState } from "../engine/types";
import { mediaUrl } from "../gamefile/library";
import { SOUNDBOARD_SLOTS, type GameFile } from "../gamefile/schema";
import { send } from "../sync/channel";
import { hasSave } from "../sync/save";
import { formatPoints } from "../format";
import { useHost } from "./useHost";
import "./host.css";

export function HostConsole() {
  const host = useHost();
  const { games, state, game, dispatch, undo } = host;
  const [pickedId, setPickedId] = useState<string | null>(state?.gameId ?? games[0]?.id ?? null);
  const picked = games.find((g) => g.id === pickedId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        // Space means nothing in a wager box, so it stays Continue: type 800, press Space.
        const numberBox = target instanceof HTMLInputElement && target.type === "number";
        if (e.key === "Escape" || e.key === "Enter" || (numberBox && e.key === " ")) target.blur();
        if (!(numberBox && e.key === " ")) return;
      }
      if (!state || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const n = Number(key);
      if (n >= 1 && n <= state.contestants.length) dispatch({ type: "buzz", contestant: state.contestants[n - 1].id });
      else if (key === " ") dispatch({ type: "continue", at: Date.now() });
      else if (key === "c") dispatch({ type: "judge", correct: true });
      else if (key === "w") dispatch({ type: "judge", correct: false });
      else if (key === "n") dispatch({ type: "nobody" });
      else if (key === "u") undo();
      else return;
      e.preventDefault();
    };
    // Clicked buttons must not keep focus, or Space would click them again.
    const onClick = (e: MouseEvent) => (e.target as HTMLElement).closest("button")?.blur();
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [state, dispatch, undo]);

  return (
    <div className="host">
      <header className="host-bar">
        <strong>Host Console</strong>
        <select value={pickedId ?? ""} onChange={(e) => setPickedId(e.target.value)}>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.result.ok ? "✔" : "✘"} {g.fileName}
            </option>
          ))}
        </select>
        <button disabled={!picked || !hasSave(picked.id)} onClick={() => picked && host.resume(picked.id)}>
          Resume
        </button>
        <button
          disabled={!picked?.result.ok}
          onClick={() => {
            if (picked && confirm(`Start a NEW game from ${picked.fileName}? The current Save for it is lost.`)) {
              host.startNew(picked.id);
            }
          }}
        >
          New game
        </button>
        <button onClick={() => window.open("/#/stage", "moltiboso-stage", "popup,width=1280,height=720")}>
          Open Stage window
        </button>
        <span className="muted">
          {state ? `Playing: ${state.gameId}` : "No game running"} · keys: 1–{state?.contestants.length ?? 6} buzz · C
          correct · W wrong · N nobody · Space continue · U undo
        </span>
      </header>

      {picked && picked.result.issues.length > 0 && (
        <ul className="issues">
          {picked.result.issues.map((i, k) => (
            <li key={k} className={i.severity}>
              <b>{i.severity}</b> {i.path}: {i.message}
            </li>
          ))}
        </ul>
      )}

      {state && !game && (
        <p className="issues error">
          The Game File for the running game ({state.gameId}) is missing or invalid. Fix it and save; the game
          continues.
        </p>
      )}

      {state && game && (
        <main className="host-main">
          <section className="panel">
            <Status game={game} state={state} />
            <Controls state={state} dispatch={dispatch} undo={undo} canUndo={!!host.history?.past.length} />
            <Current game={game} state={state} dispatch={dispatch} />
          </section>
          <section className="panel">
            <Contestants game={game} state={state} dispatch={dispatch} />
            <MiniBoard game={game} state={state} dispatch={dispatch} />
            <Soundboard game={game} />
          </section>
        </main>
      )}
    </div>
  );
}

type Dispatch = ReturnType<typeof useHost>["dispatch"];
interface Props {
  game: GameFile;
  state: GameState;
  dispatch: Dispatch;
}

function continueHint(game: GameFile, state: GameState): string | null {
  const p = state.phase;
  const ids = state.contestants.map((c) => c.id);
  const score = (id: string) => state.contestants.find((c) => c.id === id)?.score ?? 0;
  switch (p.kind) {
    case "title":
      return "Start Contestant intros";
    case "intro":
      return p.index + 1 < state.contestants.length ? "Next Contestant" : "Show the Board";
    case "board":
      return null;
    case "bonusReveal":
      return state.picker && isValidWager(game, score(state.picker), p.wager) ? "Show the Bonus Question" : null;
    case "question":
      return {
        open: null,
        buzzed: "Start Countdown (optional)",
        counting: null,
        answered: "Reveal the answer",
        answerShown: isBoardEmpty(game, state) ? "End the Round" : "Back to the Board",
      }[p.step];
    case "roundEnd":
      return state.round + 1 < game.rounds.length
        ? `Start ${game.rounds[state.round + 1].name}`
        : "Start the Final Wager";
    case "final":
      if (p.step === "category")
        return ids.every((id) => isValidWager(game, score(id), p.wagers[id] ?? null))
          ? "Show the Final question"
          : null;
      if (p.step === "question")
        return ids.every((id) => typeof p.verdicts[id] === "boolean") ? "Start the reveal" : null;
      if (p.step === "reveal") {
        if (p.revealStep === "spotlight") return "Show right / wrong";
        if (p.revealStep === "verdict") return "Show wager and new score";
        return p.revealIndex + 1 < p.order.length ? "Next Contestant" : "Crown the winner";
      }
      return null;
  }
}

function phaseLabel(game: GameFile, state: GameState): string {
  const p = state.phase;
  switch (p.kind) {
    case "title":
      return "Title screen";
    case "intro":
      return `Intro: ${state.contestants[p.index]?.name}`;
    case "board":
      return `${game.rounds[state.round]?.name}: click a Question on the mini-board`;
    case "bonusReveal":
      return "BONUS: enter the Picker's wager";
    case "question":
      return {
        open: "Question open: waiting for a buzz",
        buzzed: "Buzzed in: judge with C / W",
        counting: "Countdown running: judge with C / W",
        answered: "Answered",
        answerShown: "Answer shown",
      }[p.step];
    case "roundEnd":
      return "Round over";
    case "final":
      return {
        category: "Final Wager: enter every wager",
        question: "Final Wager: mark every answer ✓ / ✗",
        reveal: "Final Wager: reveal",
        winner: "Winner!",
      }[p.step];
  }
}

function Status({ game, state }: { game: GameFile; state: GameState }) {
  const hint = continueHint(game, state);
  const picker = state.contestants.find((c) => c.id === state.picker);
  return (
    <div className="status">
      <div className="phase">{phaseLabel(game, state)}</div>
      <div>
        <kbd>Space</kbd> {hint ?? <span className="muted">does nothing now</span>}
      </div>
      <div className="muted">Picker: {picker?.name ?? "—"}</div>
    </div>
  );
}

function Controls({
  state,
  dispatch,
  undo,
  canUndo,
}: {
  state: GameState;
  dispatch: Dispatch;
  undo: () => void;
  canUndo: boolean;
}) {
  const p = state.phase;
  const judging = p.kind === "question" && (p.step === "buzzed" || p.step === "counting");
  return (
    <div className="controls">
      <button className="big" onClick={() => dispatch({ type: "continue", at: Date.now() })}>
        Continue <kbd>Space</kbd>
      </button>
      <button className="big good" disabled={!judging} onClick={() => dispatch({ type: "judge", correct: true })}>
        Correct <kbd>C</kbd>
      </button>
      <button className="big bad" disabled={!judging} onClick={() => dispatch({ type: "judge", correct: false })}>
        Wrong <kbd>W</kbd>
      </button>
      <button disabled={!(p.kind === "question" && p.step === "open")} onClick={() => dispatch({ type: "nobody" })}>
        Nobody <kbd>N</kbd>
      </button>
      <button disabled={!canUndo} onClick={undo}>
        Undo <kbd>U</kbd>
      </button>
    </div>
  );
}

function Current({ game, state, dispatch }: Props) {
  const p = state.phase;
  if (p.kind === "bonusReveal" || p.kind === "question") {
    const q = questionAt(game, p.ref);
    const category = game.rounds[p.ref.round]?.categories[p.ref.category]?.name;
    const picker = state.contestants.find((c) => c.id === state.picker);
    return (
      <div className="current">
        <div className="muted">
          {category} · {formatPoints(valueAt(game, p.ref))}
          {q?.bonus && " · BONUS"}
        </div>
        <p className="question">{q?.question}</p>
        <p className="answer">
          Answer: <b>{q?.answer}</b>
        </p>
        {q?.image && <img className="thumb" src={mediaUrl(q.image)} alt="" />}
        {q?.audio && <AudioButtons file={q.audio} key={q.audio} />}
        {p.kind === "bonusReveal" && picker && (
          <WagerInput
            label={`${picker.name}'s wager`}
            max={maxWager(game, picker.score)}
            value={p.wager}
            onChange={(amount) => dispatch({ type: "setWager", contestant: picker.id, amount })}
          />
        )}
        {p.kind === "question" && p.wager !== null && <div>Wager: {formatPoints(p.wager)}</div>}
      </div>
    );
  }
  if (p.kind === "final") return <FinalPanel game={game} state={state} dispatch={dispatch} />;
  return null;
}

function AudioButtons({ file }: { file: string }) {
  const stop = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = mediaUrl(file);

  const setAndTell = (value: boolean) => {
    setPlaying(value);
    send({ type: "audio", playing: value });
  };
  const halt = () => {
    stop.current?.();
    stop.current = null;
  };
  const play = () => {
    if (!url) return;
    halt();
    setError(null);
    const thisStop = playClip(url, {
      onEnd: () => {
        if (stop.current !== thisStop) return; // a Replay took over
        stop.current = null;
        setAndTell(false);
      },
      onError: setError,
    });
    stop.current = thisStop;
    setAndTell(true);
  };

  // Audio stops when the Question leaves.
  useEffect(
    () => () => {
      stop.current?.();
      stop.current = null;
      send({ type: "audio", playing: false });
    },
    [],
  );

  return (
    <div className="row">
      <button disabled={!url} onClick={play}>
        ▶ {playing ? "Replay" : "Play"} audio
      </button>
      <button
        disabled={!playing}
        onClick={() => {
          halt();
          setAndTell(false);
        }}
      >
        ⏹ Stop
      </button>
      {error && <span className="sound-error">Sound didn't play: {error}</span>}
    </div>
  );
}

function WagerInput({
  label,
  max,
  value,
  onChange,
}: {
  label: string;
  max: number;
  value: number | null;
  onChange: (amount: number | null) => void;
}) {
  const invalid = value !== null && (value < 0 || value > max || !Number.isInteger(value));
  return (
    <label className={`wager ${invalid ? "invalid" : ""}`}>
      {label} (0–{formatPoints(max)}):
      <input
        type="number"
        min={0}
        max={max}
        step={100}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </label>
  );
}

function FinalPanel({ game, state, dispatch }: Props) {
  const p = state.phase;
  if (p.kind !== "final") return null;
  return (
    <div className="current">
      <div className="muted">Final Wager · {game.final.category}</div>
      <p className="question">{game.final.question}</p>
      <p className="answer">
        Answer: <b>{game.final.answer}</b>
      </p>
      {game.final.audio && <AudioButtons file={game.final.audio} />}
      <table className="final">
        <tbody>
          {state.contestants.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{formatPoints(c.score)}</td>
              <td>
                {p.step === "category" || p.step === "question" ? (
                  <WagerInput
                    label="wager"
                    max={maxWager(game, c.score)}
                    value={p.wagers[c.id] ?? null}
                    onChange={(amount) => dispatch({ type: "setWager", contestant: c.id, amount })}
                  />
                ) : (
                  formatPoints(p.wagers[c.id] ?? 0)
                )}
              </td>
              <td>
                {(["✓", "✗"] as const).map((mark) => {
                  const value = mark === "✓";
                  return (
                    <button
                      key={mark}
                      disabled={p.step !== "question"}
                      className={p.verdicts[c.id] === value ? (value ? "good" : "bad") : ""}
                      onClick={() =>
                        dispatch({
                          type: "judgeFinal",
                          contestant: c.id,
                          correct: p.verdicts[c.id] === value ? null : value,
                        })
                      }
                    >
                      {mark}
                    </button>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {p.step === "category" && <p className="muted">Write the wagers in while the category is on the Stage.</p>}
    </div>
  );
}

function Contestants({ game, state, dispatch }: Props) {
  const p = state.phase;
  const [name, setName] = useState("");
  return (
    <div>
      <h3>Contestants</h3>
      <table className="contestants">
        <tbody>
          {state.contestants.map((c, i) => {
            const buzzed = p.kind === "question" && p.buzzed === c.id;
            const tried = p.kind === "question" && p.tried.includes(c.id);
            return (
              <tr key={c.id} className={buzzed ? "buzzed" : tried ? "tried" : ""}>
                <td>
                  <kbd>{i + 1}</kbd>
                </td>
                <td>
                  <button className="link" onClick={() => dispatch({ type: "buzz", contestant: c.id })}>
                    {c.name}
                  </button>
                  {state.picker === c.id && " 👑"}
                </td>
                <td className="num">{formatPoints(c.score)}</td>
                <td>
                  <ScoreAdjust onAdjust={(delta) => dispatch({ type: "adjustScore", contestant: c.id, delta })} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {state.contestants.length < 6 && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: "addContestant", name });
            setName("");
          }}
        >
          <input placeholder="Late arrival's name" value={name} onChange={(e) => setName(e.target.value)} />
          <button disabled={!name.trim()}>Add contestant</button>
        </form>
      )}
      <p className="muted">Wager Floor: {formatPoints(game.wagerFloor)}</p>
    </div>
  );
}

function ScoreAdjust({ onAdjust }: { onAdjust: (delta: number) => void }) {
  const [amount, setAmount] = useState(100);
  return (
    <span className="row">
      <button onClick={() => onAdjust(-amount)}>−</button>
      <input
        className="small"
        type="number"
        step={100}
        value={amount}
        onChange={(e) => setAmount(Math.abs(Number(e.target.value)))}
      />
      <button onClick={() => onAdjust(amount)}>+</button>
    </span>
  );
}

function MiniBoard({ game, state, dispatch }: Props) {
  const round = game.rounds[state.round];
  if (!round) return null;
  const onBoard = state.phase.kind === "board";
  return (
    <div>
      <h3>{round.name}</h3>
      <div className="mini-board" style={{ gridTemplateColumns: `repeat(${round.categories.length}, 1fr)` }}>
        {round.categories.map((cat) => (
          <div key={cat.name} className="cat">
            {cat.name}
          </div>
        ))}
        {round.values.map((value, index) =>
          round.categories.map((cat, category) => {
            const ref = { round: state.round, category, index };
            const played = state.played.includes(refKey(ref));
            const q = cat.questions[index];
            return (
              <button
                key={refKey(ref)}
                className={`tile ${q?.bonus ? "bonus" : ""}`}
                disabled={played || !onBoard}
                title={q?.question}
                onClick={() => dispatch({ type: "select", ref })}
              >
                {played ? "" : formatPoints(value)}
                {!played && q?.bonus && " ★"}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

function Soundboard({ game }: { game: GameFile }) {
  const slots = game.sounds.soundboard ?? [];
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <h3>Soundboard</h3>
      <div className="row">
        {Array.from({ length: SOUNDBOARD_SLOTS }, (_, index) => {
          const slot = slots[index];
          return (
            <button
              key={index}
              disabled={!slot || !mediaUrl(slot.file)}
              onClick={() => {
                const url = mediaUrl(slot?.file);
                setError(null);
                if (url) playClip(url, { onError: (message) => setError(`${slot?.label}: ${message}`) });
              }}
            >
              {slot?.label ?? `Slot ${index + 1}`}
            </button>
          );
        })}
      </div>
      {error && <p className="sound-error">Sound didn't play: {error}</p>}
    </div>
  );
}
