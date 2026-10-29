/**
 * Play a sound file with a plain <audio> element. Call it straight from a click
 * handler: browsers (Safari included) always allow playback started by a click,
 * and there is no long-lived AudioContext that Safari can leave suspended.
 * Returns a function that stops the clip (without calling onEnd).
 */
export function playClip(
  url: string,
  { onEnd, onError }: { onEnd?: () => void; onError?: (message: string) => void } = {},
): () => void {
  const audio = new Audio(url);
  let stopped = false;
  const fail = (message: string) => {
    if (stopped) return;
    console.error(`Could not play ${url}: ${message}`);
    onError?.(message);
    onEnd?.();
  };
  audio.addEventListener("ended", () => onEnd?.());
  audio.addEventListener("error", () => fail(audio.error?.message || "the file could not be loaded"));
  audio.play().catch((e: unknown) => fail(e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
  return () => {
    stopped = true;
    audio.pause();
  };
}
