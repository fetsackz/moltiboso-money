type Stop = () => void;

/**
 * Plays sound files through Web Audio rather than <audio> elements: once the
 * window's AudioContext is unlocked by a click, every later play is allowed,
 * even when it isn't triggered by a click itself (Safari blocks those for <audio>).
 */
export class FilePlayer {
  private ctx = new AudioContext();
  private buffers = new Map<string, Promise<AudioBuffer>>();

  get unlocked() {
    return this.ctx.state === "running";
  }

  unlock() {
    return this.ctx.resume();
  }

  /** Called whenever the browser suspends or resumes this window's sound (Safari does both on its own). */
  onStateChange(listener: () => void) {
    this.ctx.addEventListener("statechange", listener);
  }

  play(url: string, { loop = false, onEnd }: { loop?: boolean; onEnd?: () => void } = {}): Stop {
    let source: AudioBufferSourceNode | null = null;
    let stopped = false;
    void this.ctx.resume();
    this.load(url)
      .then((buffer) => {
        if (stopped) return;
        source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        source.connect(this.ctx.destination);
        source.onended = () => onEnd?.();
        source.start();
      })
      .catch((e) => {
        console.error(`Could not play ${url}`, e);
        onEnd?.();
      });
    return () => {
      stopped = true;
      source?.stop();
    };
  }

  private load(url: string): Promise<AudioBuffer> {
    let buffer = this.buffers.get(url);
    if (!buffer) {
      buffer = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then((data) => this.ctx.decodeAudioData(data));
      buffer.catch(() => this.buffers.delete(url));
      this.buffers.set(url, buffer);
    }
    return buffer;
  }
}
