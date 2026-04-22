// ─── Dev-only test tracks ────────────────────────────────────────────────────
// Drop mp3s into apps/mobile/assets/ and add entries here.
// Use in any screen: audioEngine.loadTrack("A", TEST_TRACKS[0].uri)
//
// Remove this file (or the import) before shipping.

export interface TestTrack {
  title:  string;
  artist: string;
  uri:    number; // Expo asset require() returns a number
}

export const TEST_TRACKS: TestTrack[] = [
  // Uncomment and rename to match your actual files:
  // { title: "Track 1", artist: "Test", uri: require("../../assets/track1.mp3") },
  // { title: "Track 2", artist: "Test", uri: require("../../assets/track2.mp3") },
  // { title: "Track 3", artist: "Test", uri: require("../../assets/track3.mp3") },
  // { title: "Track 4", artist: "Test", uri: require("../../assets/track4.mp3") },
  // { title: "Track 5", artist: "Test", uri: require("../../assets/track5.mp3") },
];
