import { useEffect, useState } from "react";
import { playSound } from "../sounds";

export type CutTier = "banner" | "overlay" | "peak";

interface Scene {
  name: string;
  seq: number;
  tier?: CutTier;       // default "overlay" for back-compat
  sound?: string;       // optional override (default chosen by tier)
}

interface Props {
  scene: Scene | null;
  onDone: () => void;
}

const TIER_DURATION_MS: Record<CutTier, number> = {
  banner: 1500,
  overlay: 2200,
  peak: 3000,
};

const TIER_DEFAULT_SOUND: Record<CutTier, string> = {
  banner: "cut-banner",
  overlay: "cut-overlay",
  peak: "cut-peak",
};

// Words that get a signature audio sting — overrides tier default.
const SIGNATURE_SOUND: Record<string, string> = {
  "KOBE": "kobe",
  "GUTTER BALL": "gutter-ball",
  "FLAWLESS": "flawless",
  "UNTOUCHED": "untouched",
  "DAGGER": "dagger",
};

export default function CutScene({ scene, onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!scene) return;

    const tier: CutTier = scene.tier ?? "overlay";
    const dur = TIER_DURATION_MS[tier];
    const sting = scene.sound ?? SIGNATURE_SOUND[scene.name] ?? TIER_DEFAULT_SOUND[tier];

    // Fire audio sting at scene start.
    try { playSound(sting); } catch { /* ignore */ }

    setVisible(true);
    let inner: ReturnType<typeof setTimeout>;
    const t = setTimeout(() => {
      setVisible(false);
      inner = setTimeout(onDone, 350);
    }, dur);
    return () => { clearTimeout(t); clearTimeout(inner); };
  }, [scene?.seq]);

  if (!scene) return null;

  const tier: CutTier = scene.tier ?? "overlay";

  return (
    <div className={`cutscene cs-${tier} ${visible ? "cs-in" : "cs-out"}`}>
      {tier !== "banner" && <div className="cutscene-pulse" />}
      <div className="cutscene-text">{scene.name}</div>
    </div>
  );
}
