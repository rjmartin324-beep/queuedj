const supported = typeof navigator !== "undefined" && "vibrate" in navigator;

function vibe(pattern: number | number[]) {
  if (supported) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

export const haptic = {
  tap:     () => vibe(8),           // light — any button press
  lock:    () => vibe([12, 20, 18]),// double-pulse — answer locked in
  wrong:   () => vibe([30, 20, 30]),// error buzz — wrong answer
  correct: () => vibe(40),          // solid thump — correct
  heavy:   () => vibe(60),          // strong — cut scene / podium
};
