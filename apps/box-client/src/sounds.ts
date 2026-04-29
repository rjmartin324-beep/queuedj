let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.25) {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch { /* audio unavailable */ }
}

export function playSound(name: string): void {
  try {
    switch (name) {
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
    }
  } catch { /* ignore */ }
}
