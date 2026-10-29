import { parse as parseYaml } from "yaml";
import { z } from "zod";

// Paths to media are relative to the games/ folder, e.g. "media/cat.gif".
const mediaPath = z.string().min(1);

const questionSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  image: mediaPath.optional(),
  audio: mediaPath.optional(),
  bonus: z.boolean().optional(),
});

const categorySchema = z.object({
  name: z.string().min(1),
  questions: z.array(questionSchema).min(1),
});

const roundSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.number().int().positive()).min(1),
  categories: z.array(categorySchema).min(1),
});

const contestantSchema = z.object({
  name: z.string().min(1),
  photo: mediaPath.optional(),
});

const finalSchema = z.object({
  category: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  image: mediaPath.optional(),
  audio: mediaPath.optional(),
});

export const BUILTIN_SOUNDS = [
  "reveal",
  "correct",
  "wrong",
  "bonus",
  "tick",
  "timeUp",
  "think",
  "drumroll",
  "coins",
  "win",
] as const;
export type BuiltinSound = (typeof BUILTIN_SOUNDS)[number];

export const SOUNDBOARD_SLOTS = 5;

const soundsSchema = z.object({
  reveal: mediaPath.optional(),
  correct: mediaPath.optional(),
  wrong: mediaPath.optional(),
  bonus: mediaPath.optional(),
  tick: mediaPath.optional(),
  timeUp: mediaPath.optional(),
  think: mediaPath.optional(),
  drumroll: mediaPath.optional(),
  coins: mediaPath.optional(),
  win: mediaPath.optional(),
  soundboard: z
    .array(z.object({ label: z.string().min(1), file: mediaPath }))
    .max(SOUNDBOARD_SLOTS)
    .optional(),
});

export const MAX_CONTESTANTS = 6;

export const gameFileSchema = z.object({
  title: z.string().min(1).default("Moltiboso Money"),
  wagerFloor: z.number().int().nonnegative().default(1000),
  countdownSeconds: z.number().positive().default(5),
  contestants: z.array(contestantSchema).min(2).max(MAX_CONTESTANTS),
  rounds: z.array(roundSchema).min(1),
  final: finalSchema,
  sounds: soundsSchema.default({}),
});

export type GameFile = z.infer<typeof gameFileSchema>;
export type GameQuestion = z.infer<typeof questionSchema>;

export interface Issue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export type ParseResult = { ok: true; game: GameFile; issues: Issue[] } | { ok: false; issues: Issue[] };

/**
 * Parse and validate a Game File. Media paths in the file are relative to the file's
 * own folder, `baseDir` (relative to games/); the parsed game has them resolved to
 * paths relative to games/. `mediaExists` gets those resolved paths, so the caller
 * (browser or CLI) can report media that points nowhere.
 */
export function parseGameFile(raw: string, mediaExists?: (path: string) => boolean, baseDir = ""): ParseResult {
  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (e) {
    return { ok: false, issues: [{ severity: "error", path: "(yaml)", message: String(e) }] };
  }
  const result = gameFileSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((i) => ({
        severity: "error" as const,
        path: i.path.join(".") || "(root)",
        message: i.message,
      })),
    };
  }
  const game = resolveMedia(result.data, baseDir);
  const issues = checkGame(game, mediaExists);
  return issues.some((i) => i.severity === "error") ? { ok: false, issues } : { ok: true, game, issues };
}

/** Joins a media path onto the Game File's folder: "private" + "../media/a.png" → "media/a.png". */
export function resolveMediaPath(baseDir: string, path: string): string {
  const parts: string[] = [];
  for (const part of `${baseDir}/${path}`.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === ".." && parts.length && parts[parts.length - 1] !== "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function resolveMedia(game: GameFile, baseDir: string): GameFile {
  const at = (path: string | undefined) => (path ? resolveMediaPath(baseDir, path) : path);
  const sounds = Object.fromEntries(
    Object.entries(game.sounds).map(([key, file]) => [key, typeof file === "string" ? at(file) : file]),
  ) as GameFile["sounds"];
  return {
    ...game,
    contestants: game.contestants.map((c) => ({ ...c, photo: at(c.photo) })),
    rounds: game.rounds.map((r) => ({
      ...r,
      categories: r.categories.map((cat) => ({
        ...cat,
        questions: cat.questions.map((q) => ({ ...q, image: at(q.image), audio: at(q.audio) })),
      })),
    })),
    final: { ...game.final, image: at(game.final.image), audio: at(game.final.audio) },
    sounds: { ...sounds, soundboard: game.sounds.soundboard?.map((s) => ({ ...s, file: at(s.file)! })) },
  };
}

function checkGame(game: GameFile, mediaExists?: (path: string) => boolean): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, message: string) => issues.push({ severity: "error", path, message });
  const warn = (path: string, message: string) => issues.push({ severity: "warning", path, message });
  const media = (path: string, file: string | undefined) => {
    if (file && mediaExists && !mediaExists(file)) err(path, `media file not found: games/${file}`);
  };

  game.contestants.forEach((c, i) => media(`contestants.${i}.photo`, c.photo));
  game.rounds.forEach((round, r) => {
    let bonuses = 0;
    round.categories.forEach((cat, c) => {
      if (cat.questions.length !== round.values.length) {
        err(
          `rounds.${r}.categories.${c}`,
          `"${cat.name}" has ${cat.questions.length} questions but the round has ${round.values.length} values`,
        );
      }
      cat.questions.forEach((q, i) => {
        const p = `rounds.${r}.categories.${c}.questions.${i}`;
        media(`${p}.image`, q.image);
        media(`${p}.audio`, q.audio);
        if (q.bonus) bonuses++;
      });
    });
    if (bonuses === 0) warn(`rounds.${r}`, `"${round.name}" has no Bonus Question`);
  });
  media("final.image", game.final.image);
  media("final.audio", game.final.audio);
  for (const [key, file] of Object.entries(game.sounds)) {
    if (typeof file === "string") media(`sounds.${key}`, file);
  }
  game.sounds.soundboard?.forEach((s, i) => media(`sounds.soundboard.${i}.file`, s.file));
  return issues;
}
