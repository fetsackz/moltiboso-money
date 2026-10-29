// npm run check [games/file.yaml ...] — validate Game Files; all of games/ if none given.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseGameFile } from "../src/gamefile/schema";

const gamesDir = resolve(import.meta.dirname, "../games");
const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((f) => resolve(f))
  : readdirSync(gamesDir)
      .filter((f) => /\.ya?ml$/.test(f))
      .map((f) => join(gamesDir, f));

let failed = false;
for (const file of files) {
  const root = dirname(file);
  const result = parseGameFile(readFileSync(file, "utf8"), (p) => existsSync(join(root, p)));
  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");
  console.log(`${result.ok ? "✔" : "✘"} ${file}`);
  for (const i of [...errors, ...warnings]) {
    console.log(`  ${i.severity === "error" ? "error  " : "warning"} ${i.path}: ${i.message}`);
  }
  if (result.ok) {
    const g = result.game;
    const count = g.rounds.reduce((n, r) => n + r.categories.length * r.values.length, 0);
    console.log(`  ${g.contestants.length} contestants, ${g.rounds.length} rounds, ${count} questions + final`);
  }
  failed ||= !result.ok;
}
process.exit(failed ? 1 : 0);
