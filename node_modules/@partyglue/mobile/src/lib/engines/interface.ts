// ─────────────────────────────────────────────────────────────────────────────
// AudioEngineInterface — The contract both engines must satisfy
//
// Path A (now):   WebAudioEngine implements this
// Path B (later): SuperpoweredEngine implements this
//
// Every screen/component imports AudioEngine from engines/index.ts
// Never import WebAudioEngine or SuperpoweredEngine directly.
// Swapping engines = one line change in engines/index.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface AudioEngineInterface {
  init(): Promise<void>;
  loadTrack(deckId: "A" | "B", uri: string): Promise<void>;
  play(deckId: "A" | "B"): Promise<void>;
  pause(deckId: "A" | "B"): Promise<void>;
  seek(deckId: "A" | "B", positionMs: number): Promise<void>;
  setCrossfader(value: number): void;          // 0.0 = full A, 1.0 = full B
  setEQ(deckId: "A" | "B", low: number, mid: number, high: number): void;
  setVolume(deckId: "A" | "B", volume: number): void;
  getPosition(deckId: "A" | "B"): Promise<number>;
  isPlaying(deckId: "A" | "B"): boolean;
  crossfadeToB(durationMs: number): Promise<void>;
  onPositionChange(cb: (deckId: "A" | "B", posMs: number) => void): void;
  destroy(): Promise<void>;
}
