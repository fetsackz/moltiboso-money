import type { BuiltinSound } from "../gamefile/schema";
import { FilePlayer } from "./files";
import { Synth } from "./synth";

type Stop = () => void;

/** The Stage's show sounds: each built-in is synthesized, or an override file from the Game File. */
export class SoundPlayer {
  private synth = new Synth();
  private files = new FilePlayer();
  private loops = new Map<BuiltinSound, Stop>();
  /** Built-in name → URL of an override file from the Game File. */
  overrides: Partial<Record<BuiltinSound, string>> = {};

  get unlocked() {
    return this.synth.unlocked && this.files.unlocked;
  }

  onStateChange(listener: () => void) {
    this.synth.onStateChange(listener);
    this.files.onStateChange(listener);
  }

  unlock() {
    return Promise.all([this.synth.unlock(), this.files.unlock()]);
  }

  play(name: BuiltinSound): Stop {
    const url = this.overrides[name];
    return url ? this.files.play(url) : this.synth.play(name);
  }

  /** Start a looping sound (e.g. think music) once; stopLoop() ends it. */
  loop(name: BuiltinSound) {
    if (this.loops.has(name)) return;
    const url = this.overrides[name];
    this.loops.set(name, url ? this.files.play(url, { loop: true }) : this.synth.play(name));
  }

  stopLoop(name: BuiltinSound) {
    this.loops.get(name)?.();
    this.loops.delete(name);
  }
}
