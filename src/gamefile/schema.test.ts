import { describe, expect, it } from "vitest";
import { parseGameFile, resolveMediaPath } from "./schema";

describe("resolveMediaPath", () => {
  it("joins media paths onto the Game File's folder", () => {
    expect(resolveMediaPath("", "media/a.png")).toBe("media/a.png");
    expect(resolveMediaPath("private", "media/a.png")).toBe("private/media/a.png");
    expect(resolveMediaPath("private", "../media/flag.svg")).toBe("media/flag.svg");
    expect(resolveMediaPath("private/2026", "./x/../b.mp3")).toBe("private/2026/b.mp3");
  });
});

describe("parseGameFile", () => {
  const raw = `
contestants: [{ name: A, photo: media/a.png }, { name: B }]
rounds:
  - name: R
    values: [100]
    categories: [{ name: C, questions: [{ question: q, answer: a, image: ../media/flag.svg }] }]
final: { category: c, question: q, answer: a }
sounds: { correct: media/ding.mp3, soundboard: [{ label: Horn, file: media/horn.mp3 }] }
`;

  it("resolves every media path relative to the Game File's folder", () => {
    const seen: string[] = [];
    const result = parseGameFile(raw, (p) => (seen.push(p), true), "private");
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(result.game.contestants[0].photo).toBe("private/media/a.png");
    expect(result.game.rounds[0].categories[0].questions[0].image).toBe("media/flag.svg");
    expect(result.game.sounds.correct).toBe("private/media/ding.mp3");
    expect(result.game.sounds.soundboard?.[0].file).toBe("private/media/horn.mp3");
    expect(seen).toContain("private/media/horn.mp3");
  });

  it("reports missing media by its path under games/", () => {
    const result = parseGameFile(raw, (p) => p !== "private/media/horn.mp3", "private");
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.message)).toContain("media file not found: games/private/media/horn.mp3");
  });
});
