// Kept apart from library.ts so a Game File edit hot-swaps only this module
// (library.ts accepts it) instead of reloading the page and losing audio unlock.
export const yamlSources = import.meta.glob("/games/*.{yaml,yml}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const mediaSources = import.meta.glob("/games/media/**/*", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;
