import { refKey } from "../engine/engine";
import type { GameState } from "../engine/types";
import type { GameFile } from "../gamefile/schema";
import { formatPoints } from "../format";

export function Board({ game, state, entering }: { game: GameFile; state: GameState; entering: boolean }) {
  const round = game.rounds[state.round];
  if (!round) return null;
  const cols = round.categories.length;
  const picker = state.contestants.find((c) => c.id === state.picker);
  return (
    <div className={`board-wrap ${entering ? "entering" : ""}`}>
      <div className="board-head">
        <span className="round-name">{round.name}</span>
        {picker && (
          <span className="picker-call">
            <b>{picker.name}</b>, pick a question
          </span>
        )}
      </div>
      <div className="board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {round.categories.map((cat, c) => (
          <div key={`cat-${c}`} className="board-cat" style={{ animationDelay: `${c * 90}ms` }}>
            <span>{cat.name}</span>
          </div>
        ))}
        {round.values.map((value, index) =>
          round.categories.map((_, category) => {
            const ref = { round: state.round, category, index };
            const played = state.played.includes(refKey(ref));
            return (
              <div
                key={refKey(ref)}
                className={`board-tile ${played ? "played" : ""}`}
                style={{ animationDelay: `${300 + (index * cols + category) * 25}ms` }}
              >
                {!played && <span>{formatPoints(value)}</span>}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
