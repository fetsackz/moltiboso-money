import type { Contestant, GameState } from "../engine/types";
import { mediaUrl } from "../gamefile/library";
import { formatPoints } from "../format";
import { useRolling } from "./hooks";

export function Avatar({ contestant, size }: { contestant: Contestant; size: number }) {
  const url = mediaUrl(contestant.photo);
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {url ? <img src={url} alt="" /> : <span>{monogram(contestant.name)}</span>}
    </div>
  );
}

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function Score({ value, animate, className = "" }: { value: number; animate: boolean; className?: string }) {
  const shown = useRolling(value, animate);
  return <span className={`score ${shown < 0 ? "negative" : ""} ${className}`}>{formatPoints(shown)}</span>;
}

export interface PodiumHighlight {
  buzzed?: string | null;
  tried?: string[];
  spotlight?: string | null;
  /** 0..1 of the Countdown left, for the buzzed Contestant's ring. */
  countdown?: number | null;
}

export function Podiums({
  state,
  animate,
  highlight = {},
}: {
  state: GameState;
  animate: boolean;
  highlight?: PodiumHighlight;
}) {
  return (
    <div className="podiums">
      {state.contestants.map((c, i) => {
        const classes = [
          "podium",
          state.picker === c.id && "picker",
          highlight.buzzed === c.id && "buzzed",
          highlight.tried?.includes(c.id) && "tried",
          highlight.spotlight && (highlight.spotlight === c.id ? "spotlit" : "dimmed"),
        ]
          .filter(Boolean)
          .join(" ");
        const ring = highlight.buzzed === c.id ? highlight.countdown : null;
        return (
          <div key={c.id} className={classes} data-podium={c.id}>
            <div className="podium-crown">♛</div>
            <div className="podium-avatar">
              <Avatar contestant={c} size={92} />
              {ring != null && <CountdownRing fraction={ring} size={112} />}
            </div>
            <div className="podium-text">
              <div className="podium-name">
                <span className="podium-key">{i + 1}</span>
                {c.name}
              </div>
              <Score value={c.score} animate={animate} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CountdownRing({ fraction, size }: { fraction: number; size: number }) {
  const r = size / 2 - 5;
  const circumference = 2 * Math.PI * r;
  return (
    <svg className={`ring ${fraction <= 0 ? "expired" : ""}`} width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fill"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.max(0, fraction))}
      />
    </svg>
  );
}
