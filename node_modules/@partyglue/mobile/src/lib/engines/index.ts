// ─── THE SWAP ─────────────────────────────────────────────────────────────────
// Path A (now):   Web Audio API — works in browser, demo-ready
// Path B (later): Uncomment SuperpoweredEngine, comment out WebAudioEngine
//
// Everything in the app imports from HERE. Never from the engine files directly.
// ─────────────────────────────────────────────────────────────────────────────

export { WebAudioEngine as AudioEngine } from "./WebAudioEngine";

// Path B — uncomment when Superpowered bridge is ready:
// export { SuperpoweredEngine as AudioEngine } from "./SuperpoweredEngine";
