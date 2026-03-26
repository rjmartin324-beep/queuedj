// ─────────────────────────────────────────────────────────────────────────────
// audioBPM.ts — Web Audio API based BPM detection + transition point finder
//
// Works in browser only (Web Audio API). Falls back to safe defaults on native.
// ─────────────────────────────────────────────────────────────────────────────

export interface AudioAnalysis {
  bpm:            number;  // detected tempo
  transitionMs:   number;  // best point to start crossfading (ms)
  beatIntervalMs: number;  // one beat in ms
  barIntervalMs:  number;  // one bar (4 beats) in ms
  confidence:     number;  // 0–1
}

// Results cached by URL so the same track is never analyzed twice
const cache = new Map<string, AudioAnalysis>();

function fallback(durationMs: number): AudioAnalysis {
  const bpm = 120;
  return {
    bpm,
    transitionMs:   Math.round(durationMs * 0.73),
    beatIntervalMs: 500,
    barIntervalMs:  2000,
    confidence:     0,
  };
}

export async function analyzeTrack(url: string, durationMs: number): Promise<AudioAnalysis> {
  if (cache.has(url)) return cache.get(url)!;

  const AudioCtx: typeof AudioContext | undefined =
    (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!AudioCtx) return fallback(durationMs);

  try {
    const res         = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const ctx         = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    ctx.close();

    const bpm            = detectBPM(audioBuffer);
    const transitionMs   = findTransitionPoint(audioBuffer, bpm, durationMs);
    const beatIntervalMs = 60000 / bpm;
    const barIntervalMs  = beatIntervalMs * 4;
    const confidence     = bpm >= 70 && bpm <= 175 ? 0.8 : 0.4;

    const result: AudioAnalysis = { bpm, transitionMs, beatIntervalMs, barIntervalMs, confidence };
    cache.set(url, result);
    return result;
  } catch {
    return fallback(durationMs);
  }
}

// ─── BPM Detection ────────────────────────────────────────────────────────────
// Energy-based onset detection → inter-onset interval histogram → dominant tempo

function detectBPM(audioBuffer: AudioBuffer): number {
  const data       = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Downsample 4× for speed
  const STEP = 4;
  const down: number[] = [];
  for (let i = 0; i < data.length; i += STEP) down.push(Math.abs(data[i]));

  const effectiveSR = sampleRate / STEP;

  // Energy per 128-sample window (~11.6 ms at 11kHz effective rate)
  const WIN = 128;
  const energies: number[] = [];
  for (let i = 0; i + WIN < down.length; i += WIN) {
    let e = 0;
    for (let j = 0; j < WIN; j++) e += down[i + j] ** 2;
    energies.push(Math.sqrt(e / WIN));
  }
  if (energies.length < 8) return 120;

  // Onset detection: energy spike above local mean
  const LOOKBACK = 16;
  const onsets: number[] = [];
  for (let i = LOOKBACK; i < energies.length - 1; i++) {
    const localMean = energies.slice(i - LOOKBACK, i).reduce((a, b) => a + b, 0) / LOOKBACK;
    if (energies[i] > localMean * 1.4 && energies[i] > energies[i - 1]) {
      onsets.push(i);
    }
  }
  if (onsets.length < 4) return 120;

  // Inter-onset intervals in ms
  const winMs = (WIN / effectiveSR) * 1000;
  const intervalsMs = onsets.slice(1).map((o, i) => (o - onsets[i]) * winMs);

  // Histogram bucketed to 10 ms
  const BUCKET = 10;
  const hist: Record<number, number> = {};
  for (const ms of intervalsMs) {
    const b = Math.round(ms / BUCKET) * BUCKET;
    hist[b] = (hist[b] || 0) + 1;
  }

  // Weighted: also credit half/double-time harmonics
  const weighted: Record<number, number> = {};
  for (const [bStr, count] of Object.entries(hist)) {
    const ms = Number(bStr);
    weighted[ms]       = (weighted[ms]       || 0) + count;
    weighted[ms * 2]   = (weighted[ms * 2]   || 0) + count * 0.5;
    const half = Math.round(ms / 2 / BUCKET) * BUCKET;
    if (half > 0) weighted[half] = (weighted[half] || 0) + count * 0.5;
  }

  // Pick interval in the 70–175 BPM window with highest weight
  let best = 500;
  let bestW = 0;
  for (const [msStr, w] of Object.entries(weighted)) {
    const ms  = Number(msStr);
    const bpm = 60000 / ms;
    if (bpm >= 70 && bpm <= 175 && w > bestW) { bestW = w; best = ms; }
  }

  let bpm = Math.round(60000 / best);
  while (bpm < 70)  bpm *= 2;
  while (bpm > 175) bpm /= 2;
  return Math.max(70, Math.min(175, bpm));
}

// ─── Transition Point ─────────────────────────────────────────────────────────
// Finds where track energy drops (outro) and snaps to the nearest bar boundary.

function findTransitionPoint(
  audioBuffer: AudioBuffer,
  bpm:         number,
  durationMs:  number,
): number {
  const data       = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // RMS energy in 1-second windows
  const WIN = sampleRate;
  const windows: number[] = [];
  for (let i = 0; i + WIN < data.length; i += WIN) {
    let e = 0;
    for (let j = 0; j < WIN; j++) e += data[i + j] ** 2;
    windows.push(Math.sqrt(e / WIN));
  }
  if (windows.length < 4) return durationMs * 0.73;

  const bodyEnd    = Math.floor(windows.length * 0.8);
  const peakEnergy = Math.max(...windows.slice(0, bodyEnd));
  const threshold  = peakEnergy * 0.65;

  // Find first window below threshold in the last 40% of the track
  const searchFrom = Math.floor(windows.length * 0.60);
  let dropIdx      = Math.floor(windows.length * 0.75);
  for (let i = searchFrom; i < windows.length - 1; i++) {
    if (windows[i] < threshold) { dropIdx = i; break; }
  }

  // Snap to nearest bar
  const barMs = (60000 / bpm) * 4;
  let ms      = Math.round((dropIdx * 1000) / barMs) * barMs;

  // Clamp: must be between 55 % and 88 % of total duration
  ms = Math.max(durationMs * 0.55, Math.min(durationMs * 0.88, ms));
  return ms;
}
