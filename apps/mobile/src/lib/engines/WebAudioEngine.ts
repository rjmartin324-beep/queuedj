// ─────────────────────────────────────────────────────────────────────────────
// Web Audio Engine — Path A (shows friends now)
//
// Uses the browser's Web Audio API via Expo AV.
// Works on web + basic mobile playback.
// Latency: ~100ms (acceptable for demo, not production DJing)
//
// When Superpowered bridge is ready (Path B), swap this file for
// SuperpoweredEngine.ts. All callers use the AudioEngine interface —
// they never know which engine is underneath.
// ─────────────────────────────────────────────────────────────────────────────

import { Audio } from "expo-av";
import type { AudioEngineInterface } from "./interface";

interface DeckState {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  bpm: number;
  positionMs: number;
  volume: number;
  eq: { low: number; mid: number; high: number };
}

class WebAudioEngineImpl implements AudioEngineInterface {
  private decks: Record<"A" | "B", DeckState> = {
    A: { sound: null, isPlaying: false, bpm: 120, positionMs: 0, volume: 1, eq: { low: 1, mid: 1, high: 1 } },
    B: { sound: null, isPlaying: false, bpm: 120, positionMs: 0, volume: 1, eq: { low: 1, mid: 1, high: 1 } },
  };
  private crossfader = 0.5; // 0 = full A, 1 = full B
  private onPositionUpdate?: (deckId: "A" | "B", posMs: number) => void;

  async init(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    });
  }

  async loadTrack(deckId: "A" | "B", uri: string): Promise<void> {
    const deck = this.decks[deckId];
    // Unload existing sound
    if (deck.sound) {
      await deck.sound.unloadAsync();
      deck.sound = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false, volume: this._deckVolume(deckId) },
    );

    // Track position changes
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded) {
        deck.positionMs = status.positionMillis;
        this.onPositionUpdate?.(deckId, status.positionMillis);
      }
    });

    deck.sound = sound;
    deck.isPlaying = false;
    deck.positionMs = 0;
  }

  async play(deckId: "A" | "B"): Promise<void> {
    const deck = this.decks[deckId];
    if (!deck.sound) return;
    await deck.sound.playAsync();
    deck.isPlaying = true;
  }

  async pause(deckId: "A" | "B"): Promise<void> {
    const deck = this.decks[deckId];
    if (!deck.sound) return;
    await deck.sound.pauseAsync();
    deck.isPlaying = false;
  }

  async seek(deckId: "A" | "B", positionMs: number): Promise<void> {
    const deck = this.decks[deckId];
    if (!deck.sound) return;
    await deck.sound.setPositionAsync(positionMs);
  }

  setCrossfader(value: number): void {
    // value: 0.0 = full A, 1.0 = full B
    this.crossfader = Math.max(0, Math.min(1, value));
    this._applyVolumes();
  }

  setEQ(deckId: "A" | "B", low: number, mid: number, high: number): void {
    // Store values for Path B (Superpowered) to apply when the native bridge is ready.
    // Web Audio API EQ via BiquadFilterNode requires chaining into expo-av's audio graph,
    // which is not exposed in Path A.
    this.decks[deckId].eq = { low, mid, high };
  }

  setVolume(deckId: "A" | "B", volume: number): void {
    this.decks[deckId].volume = Math.max(0, Math.min(1, volume));
    this._applyVolumes();
  }

  async setRate(deckId: "A" | "B", rate: number): Promise<void> {
    const deck = this.decks[deckId];
    if (!deck.sound) return;
    // Clamp to safe range; shouldCorrectPitch=true keeps pitch stable while changing tempo
    const clamped = Math.max(0.5, Math.min(2.0, rate));
    await deck.sound.setRateAsync(clamped, true);
  }

  async getPosition(deckId: "A" | "B"): Promise<number> {
    const deck = this.decks[deckId];
    if (!deck.sound) return 0;
    const status = await deck.sound.getStatusAsync();
    return status.isLoaded ? status.positionMillis : 0;
  }

  isPlaying(deckId: "A" | "B"): boolean {
    return this.decks[deckId].isPlaying;
  }

  onPositionChange(cb: (deckId: "A" | "B", posMs: number) => void): void {
    this.onPositionUpdate = cb;
  }

  async crossfadeToB(durationMs: number): Promise<void> {
    // Simple linear crossfade — no time-stretching in Path A
    const steps = 20;
    const stepMs = durationMs / steps;
    const startValue = this.crossfader;

    for (let i = 0; i <= steps; i++) {
      const newValue = startValue + ((1 - startValue) * i) / steps;
      this.setCrossfader(newValue);
      await new Promise((r) => setTimeout(r, stepMs));
    }
  }

  async destroy(): Promise<void> {
    for (const deck of Object.values(this.decks)) {
      if (deck.sound) await deck.sound.unloadAsync();
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _deckVolume(deckId: "A" | "B"): number {
    const base = this.decks[deckId].volume;
    if (deckId === "A") return base * (1 - this.crossfader);
    return base * this.crossfader;
  }

  private _applyVolumes(): void {
    for (const id of ["A", "B"] as const) {
      const deck = this.decks[id];
      if (deck.sound) {
        deck.sound.setVolumeAsync(this._deckVolume(id));
      }
    }
  }
}

export const WebAudioEngine = new WebAudioEngineImpl();
