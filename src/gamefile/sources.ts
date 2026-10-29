// Kept apart from library.ts so a Game File edit hot-swaps only this module
// (library.ts accepts it) instead of reloading the page and losing audio unlock.
// Game Files may live in subfolders of games/ (e.g. a private games/private/ repo).
export const yamlSources = import.meta.glob("/games/**/*.{yaml,yml}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const mediaSources = import.meta.glob(
  "/games/**/*.{png,jpg,jpeg,gif,webp,avif,svg,mp3,wav,ogg,oga,opus,m4a,aac,flac,webm}",
  { query: "?url", import: "default", eager: true },
) as Record<string, string>;
