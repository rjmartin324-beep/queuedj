let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.25, startOffset = 0) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + startOffset);
    g.gain.setValueAtTime(gain, c.currentTime + startOffset);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startOffset + duration);
    osc.start(c.currentTime + startOffset);
    osc.stop(c.currentTime + startOffset + duration);
  } catch { /* audio unavailable */ }
}

// Frequency sweep — used for whoosh/rising effects
function sweep(freqStart: number, freqEnd: number, duration: number, type: OscillatorType = "sine", gain = 0.2) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch { /* ignore */ }
}

// Noise burst — used for percussion / hits
function noise(duration: number, gain = 0.15, hp = 1000) {
  try {
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(hp, c.currentTime);
    const g = c.createGain();
    src.connect(filter); filter.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.start(c.currentTime);
    src.stop(c.currentTime + duration);
  } catch { /* ignore */ }
}

export function playSound(name: string): void {
  try {
    switch (name) {
      // ─── existing 7 ───────────────────────────────────────────────
      case "answer-lock":
        tone(900, 0.07, "square", 0.12);
        break;
      case "reveal-correct":
        tone(523, 0.1, "sine", 0.28);
        setTimeout(() => tone(659, 0.1, "sine", 0.28), 100);
        setTimeout(() => tone(784, 0.22, "sine", 0.28), 200);
        break;
      case "reveal-wrong":
        tone(180, 0.28, "sawtooth", 0.12);
        break;
      case "score-pop":
        tone(1046, 0.09, "sine", 0.18);
        break;
      case "countdown":
        tone(440, 0.09, "square", 0.08);
        break;
      case "timer-warning":
        tone(880, 0.06, "square", 0.08);
        break;
      case "round-end":
        [523, 659, 784, 1046].forEach((f, i) =>
          setTimeout(() => tone(f, 0.15, "sine", 0.22), i * 110));
        break;
      case "podium-1st":
        [523, 659, 784, 659, 784, 1046].forEach((f, i) =>
          setTimeout(() => tone(f, 0.16, "sine", 0.26), i * 95));
        break;

      // ─── NEW: tier-default stings (used by most callouts) ────────
      case "cut-banner":
        // Quick percussive hit — slide-in banner notification
        tone(660, 0.06, "square", 0.14);
        setTimeout(() => tone(990, 0.08, "sine", 0.18), 50);
        break;
      case "cut-overlay":
        // Mid-impact double-thump — full-screen overlay arrival
        tone(220, 0.09, "square", 0.18);
        setTimeout(() => tone(440, 0.12, "sine", 0.22), 80);
        setTimeout(() => tone(880, 0.18, "sine", 0.20), 180);
        break;
      case "cut-peak":
        // Heavy bass + crowd-roar synth — peak-tier moment (UNSTOPPABLE, TRAINWRECK)
        tone(80, 0.45, "sawtooth", 0.30);
        setTimeout(() => noise(0.35, 0.18, 600), 50);
        setTimeout(() => tone(110, 0.40, "sawtooth", 0.22), 100);
        break;

      // ─── NEW: 5 signature stings for iconic callouts ──────────────
      case "kobe":
        // Rising whoosh + bass thump — sports impact (5-streak)
        sweep(220, 880, 0.35, "sawtooth", 0.20);
        setTimeout(() => tone(60, 0.20, "sawtooth", 0.32), 320);
        setTimeout(() => noise(0.10, 0.15, 1200), 320);
        break;
      case "gutter-ball":
        // Sad trombone — descending sawtooth, classic "wah wah"
        sweep(440, 220, 0.28, "sawtooth", 0.20);
        setTimeout(() => sweep(330, 165, 0.28, "sawtooth", 0.18), 250);
        setTimeout(() => sweep(247, 110, 0.42, "sawtooth", 0.22), 500);
        break;
      case "flawless":
        // Ascending epic chord progression — blowout victory
        [440, 554, 659, 880, 1108].forEach((f, i) =>
          setTimeout(() => tone(f, 0.30, "sine", 0.22), i * 80));
        setTimeout(() => tone(1318, 0.45, "sine", 0.28), 500);
        break;
      case "untouched":
        // Sustained pristine bell — perfect game
        tone(880, 1.4, "sine", 0.25);
        setTimeout(() => tone(1108, 1.2, "sine", 0.18), 100);
        setTimeout(() => tone(1318, 1.0, "sine", 0.14), 200);
        break;
      case "dagger":
        // Sharp percussive shing — final-question game-winner steal
        noise(0.05, 0.20, 4000);
        setTimeout(() => tone(2200, 0.10, "sawtooth", 0.18), 30);
        setTimeout(() => tone(1100, 0.20, "sine", 0.22), 90);
        break;

      // ─── Whalabroad SFX ────────────────────────────────────────────
      case "wb-cannon":
        // Low boom: filtered noise burst + sub-bass thump
        noise(0.18, 0.32, 80);
        tone(60, 0.22, "sine", 0.4);
        setTimeout(() => tone(45, 0.15, "sine", 0.25), 40);
        break;
      case "wb-harpoon":
        // Metallic thunk: short noise + sharp mid-band tone
        noise(0.04, 0.18, 2400);
        setTimeout(() => tone(680, 0.06, "square", 0.22), 20);
        setTimeout(() => tone(440, 0.18, "triangle", 0.16), 40);
        break;
      case "wb-splash":
        // Water splash: noise sweep through high freqs
        noise(0.32, 0.18, 1500);
        setTimeout(() => sweep(2000, 600, 0.25, "sine", 0.10), 80);
        break;
      case "wb-wood-crack":
        // Sharp wood crack: short noise + descending tone
        noise(0.05, 0.30, 3500);
        setTimeout(() => tone(220, 0.10, "sawtooth", 0.18), 20);
        setTimeout(() => tone(140, 0.18, "triangle", 0.14), 60);
        break;
      case "wb-sinking":
        // Slow descending creak: woody bend + bubble noise
        sweep(280, 90, 1.0, "sawtooth", 0.18);
        setTimeout(() => noise(0.6, 0.10, 600), 200);
        setTimeout(() => sweep(180, 60, 0.8, "triangle", 0.12), 400);
        break;
      case "wb-kraken":
        // Deep monstrous roar: layered low sweeps
        sweep(120, 50, 1.4, "sawtooth", 0.32);
        setTimeout(() => sweep(180, 70, 1.2, "triangle", 0.22), 80);
        setTimeout(() => noise(1.0, 0.12, 200), 200);
        break;
      case "wb-storm":
        // Wind whoosh: rising-then-falling filtered noise
        noise(1.2, 0.20, 400);
        setTimeout(() => sweep(800, 200, 1.0, "sine", 0.10), 100);
        setTimeout(() => sweep(200, 600, 0.8, "sine", 0.08), 600);
        break;
      case "wb-whisper":
        // Soft bell tone — incoming ghost message
        tone(1175, 0.4, "sine", 0.15);
        setTimeout(() => tone(1568, 0.3, "sine", 0.10), 60);
        break;
      case "wb-victory":
        // Triumphant major chord — game won
        tone(523, 0.6, "triangle", 0.22);            // C
        tone(659, 0.6, "triangle", 0.18);            // E
        tone(784, 0.6, "triangle", 0.18);            // G
        setTimeout(() => tone(1047, 0.8, "sine", 0.22), 200); // C8va
        break;
    }
  } catch { /* ignore */ }
}
