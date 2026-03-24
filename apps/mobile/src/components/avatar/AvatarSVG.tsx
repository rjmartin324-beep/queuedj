import React from "react";
import Svg, {
  Circle, Ellipse, Rect, Path, G, Defs,
  RadialGradient, LinearGradient, Stop,
} from "react-native-svg";

// ─────────────────────────────────────────────────────────────────────────────
// PartyGlue Avatar — Fall Guys-style chubby 3D character with headphones
// ─────────────────────────────────────────────────────────────────────────────

export type OutfitType =
  | "default"
  | "suit"
  | "knight"
  | "astronaut"
  | "pirate"
  | "ninja"
  | "wizard"
  | "dino"
  | "angel"
  | "devil"
  | "robot";

interface AvatarProps {
  size?: number;
  bodyColor?: string;
  headphoneColor?: string;
  outfitColor?: string;
  expression?: "happy" | "cool" | "party";
  outfit?: OutfitType;
}

export function AvatarSVG({
  size = 200,
  bodyColor = "#38bdf8",
  headphoneColor = "#f97316",
  outfitColor = "#7c3aed",
  expression = "happy",
  outfit = "default",
}: AvatarProps) {
  const s  = size;
  const cx = s / 2;

  // Fall Guys proportions — giant round head, stubby body
  const headY  = s * 0.36;
  const headR  = s * 0.26;   // big head

  // Body is short & wide
  const bodyTop = headY + headR * 0.55;
  const bodyW   = s * 0.44;
  const bodyH   = s * 0.22;
  const bodyX   = cx - bodyW / 2;

  const skinLight  = lighten(bodyColor, 55);
  const skinMid    = lighten(bodyColor, 20);
  const skinDark   = darken(bodyColor, 20);
  const outfitLight = lighten(outfitColor, 30);
  const outfitDark  = darken(outfitColor, 25);

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Defs>
        {/* Head gradient — light top-left for 3D sphere feel */}
        <RadialGradient id="headGrad" cx="38%" cy="30%" r="65%">
          <Stop offset="0%"   stopColor={skinLight} />
          <Stop offset="55%"  stopColor={bodyColor} />
          <Stop offset="100%" stopColor={skinDark} />
        </RadialGradient>

        {/* Body gradient */}
        <RadialGradient id="bodyGrad" cx="40%" cy="30%" r="70%">
          <Stop offset="0%"   stopColor={outfitLight} />
          <Stop offset="100%" stopColor={outfitDark} />
        </RadialGradient>

        {/* Arm gradient */}
        <RadialGradient id="armGrad" cx="30%" cy="25%" r="70%">
          <Stop offset="0%"   stopColor={skinMid} />
          <Stop offset="100%" stopColor={skinDark} />
        </RadialGradient>

        {/* Shadow gradient on ground */}
        <RadialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor="rgba(0,0,0,0.45)" />
          <Stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </RadialGradient>

        {/* Headphone gradient */}
        <LinearGradient id="hpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor={lighten(headphoneColor, 30)} />
          <Stop offset="100%" stopColor={darken(headphoneColor, 20)} />
        </LinearGradient>
      </Defs>

      {/* ── Ground shadow ── */}
      <Ellipse cx={cx} cy={s * 0.93} rx={s * 0.28} ry={s * 0.045} fill="url(#shadowGrad)" />

      {/* ── Devil / Angel wings / tail drawn BEHIND body ── */}
      {outfit === "angel" && (
        <G>
          {/* Left wing */}
          <Path
            d={"M" + (bodyX - s * 0.01) + " " + (bodyTop + bodyH * 0.15) + " Q" + (bodyX - s * 0.22) + " " + (bodyTop - bodyH * 0.3) + " " + (bodyX - s * 0.08) + " " + (bodyTop + bodyH * 0.55)}
            fill="rgba(255,255,255,0.7)"
          />
          {/* Right wing */}
          <Path
            d={"M" + (bodyX + bodyW + s * 0.01) + " " + (bodyTop + bodyH * 0.15) + " Q" + (bodyX + bodyW + s * 0.22) + " " + (bodyTop - bodyH * 0.3) + " " + (bodyX + bodyW + s * 0.08) + " " + (bodyTop + bodyH * 0.55)}
            fill="rgba(255,255,255,0.7)"
          />
        </G>
      )}

      {outfit === "devil" && (
        <Path
          d={"M" + (cx + bodyW / 2) + " " + (bodyTop + bodyH * 0.6) + " Q" + (cx + bodyW * 0.75) + " " + (bodyTop + bodyH * 1.0) + " " + (cx + bodyW * 0.55) + " " + (bodyTop + bodyH * 1.25) + " L" + (cx + bodyW * 0.7) + " " + (bodyTop + bodyH * 1.4)}
          stroke="#ef4444"
          strokeWidth={s * 0.04}
          fill="none"
          strokeLinecap="round"
        />
      )}

      {outfit === "dino" && (
        <Path
          d={"M" + (cx + bodyW / 2) + " " + (bodyTop + bodyH * 0.8) + " Q" + (cx + bodyW * 0.8) + " " + (bodyTop + bodyH * 1.1) + " " + (cx + bodyW * 0.6) + " " + (bodyTop + bodyH * 1.3)}
          stroke="#4ade80"
          strokeWidth={s * 0.045}
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* ── Legs (stubby, Fall Guys style) ── */}
      <Ellipse
        cx={cx - bodyW * 0.17}
        cy={bodyTop + bodyH * 0.85}
        rx={bodyW * 0.16}
        ry={s * 0.1}
        fill={outfitDark}
      />
      <Ellipse
        cx={cx + bodyW * 0.17}
        cy={bodyTop + bodyH * 0.85}
        rx={bodyW * 0.16}
        ry={s * 0.1}
        fill={outfitDark}
      />
      {/* Shoes */}
      <Ellipse cx={cx - bodyW * 0.2}  cy={bodyTop + bodyH * 0.85 + s * 0.09} rx={s * 0.1}  ry={s * 0.042} fill="#111827" />
      <Ellipse cx={cx + bodyW * 0.2}  cy={bodyTop + bodyH * 0.85 + s * 0.09} rx={s * 0.1}  ry={s * 0.042} fill="#111827" />
      {/* Shoe shine */}
      <Ellipse cx={cx - bodyW * 0.23} cy={bodyTop + bodyH * 0.85 + s * 0.076} rx={s * 0.03} ry={s * 0.012} fill="rgba(255,255,255,0.18)" />
      <Ellipse cx={cx + bodyW * 0.17} cy={bodyTop + bodyH * 0.85 + s * 0.076} rx={s * 0.03} ry={s * 0.012} fill="rgba(255,255,255,0.18)" />

      {/* ── Body (rounded rect, wide & squat) ── */}
      <Rect
        x={bodyX}
        y={bodyTop}
        width={bodyW}
        height={bodyH}
        rx={bodyW * 0.42}
        fill="url(#bodyGrad)"
      />
      {/* Body shine */}
      <Ellipse
        cx={cx - bodyW * 0.1}
        cy={bodyTop + bodyH * 0.25}
        rx={bodyW * 0.18}
        ry={bodyH * 0.18}
        fill="rgba(255,255,255,0.18)"
      />
      {/* Belly button / logo patch */}
      <Circle cx={cx} cy={bodyTop + bodyH * 0.55} r={s * 0.035} fill={outfitLight} opacity={0.6} />

      {/* ── Arms (chubby rounded) ── */}
      <Ellipse
        cx={bodyX - s * 0.02}
        cy={bodyTop + bodyH * 0.45}
        rx={s * 0.075}
        ry={s * 0.11}
        fill="url(#armGrad)"
        transform={`rotate(-20, ${bodyX - s * 0.02}, ${bodyTop + bodyH * 0.45})`}
      />
      <Ellipse
        cx={bodyX + bodyW + s * 0.02}
        cy={bodyTop + bodyH * 0.45}
        rx={s * 0.075}
        ry={s * 0.11}
        fill="url(#armGrad)"
        transform={`rotate(20, ${bodyX + bodyW + s * 0.02}, ${bodyTop + bodyH * 0.45})`}
      />
      {/* Hands */}
      <Circle cx={bodyX - s * 0.06}        cy={bodyTop + bodyH * 0.68} r={s * 0.065} fill="url(#headGrad)" />
      <Circle cx={bodyX + bodyW + s * 0.06} cy={bodyTop + bodyH * 0.68} r={s * 0.065} fill="url(#headGrad)" />
      {/* Hand shine */}
      <Circle cx={bodyX - s * 0.07}        cy={bodyTop + bodyH * 0.63} r={s * 0.02} fill="rgba(255,255,255,0.3)" />
      <Circle cx={bodyX + bodyW + s * 0.05} cy={bodyTop + bodyH * 0.63} r={s * 0.02} fill="rgba(255,255,255,0.3)" />

      {/* ── Headphone band ── */}
      <Path
        d={`M${cx - headR * 0.82} ${headY - headR * 0.72}
            Q${cx} ${headY - headR * 1.6}
            ${cx + headR * 0.82} ${headY - headR * 0.72}`}
        stroke="url(#hpGrad)"
        strokeWidth={s * 0.05}
        fill="none"
        strokeLinecap="round"
      />
      {/* Ear cups */}
      <Rect x={cx - headR - s * 0.08}  y={headY - headR * 0.9}  width={s * 0.12} height={s * 0.17} rx={s * 0.045} fill="url(#hpGrad)" />
      <Rect x={cx + headR - s * 0.04}  y={headY - headR * 0.9}  width={s * 0.12} height={s * 0.17} rx={s * 0.045} fill="url(#hpGrad)" />
      {/* Ear cup inner */}
      <Rect x={cx - headR - s * 0.058} y={headY - headR * 0.78} width={s * 0.076} height={s * 0.11} rx={s * 0.028} fill={darken(headphoneColor, 30)} />
      <Rect x={cx + headR - s * 0.018} y={headY - headR * 0.78} width={s * 0.076} height={s * 0.11} rx={s * 0.028} fill={darken(headphoneColor, 30)} />
      {/* Ear cup shine */}
      <Ellipse cx={cx - headR - s * 0.035} cy={headY - headR * 0.72} rx={s * 0.018} ry={s * 0.025} fill="rgba(255,255,255,0.25)" />
      <Ellipse cx={cx + headR + s * 0.005} cy={headY - headR * 0.72} rx={s * 0.018} ry={s * 0.025} fill="rgba(255,255,255,0.25)" />

      {/* ── Head (big & round, 3D sphere) ── */}
      <Circle cx={cx} cy={headY} r={headR} fill="url(#headGrad)" />

      {/* Specular highlight — top-left white shine for 3D effect */}
      <Ellipse
        cx={cx - headR * 0.28}
        cy={headY - headR * 0.42}
        rx={headR * 0.32}
        ry={headR * 0.2}
        fill="rgba(255,255,255,0.28)"
        transform={`rotate(-30, ${cx - headR * 0.28}, ${headY - headR * 0.42})`}
      />
      {/* Smaller secondary shine */}
      <Ellipse
        cx={cx - headR * 0.48}
        cy={headY - headR * 0.28}
        rx={headR * 0.1}
        ry={headR * 0.06}
        fill="rgba(255,255,255,0.35)"
        transform={`rotate(-30, ${cx - headR * 0.48}, ${headY - headR * 0.28})`}
      />

      {/* ── Face ── */}
      {expression === "happy" && (
        <G>
          {/* Eyes */}
          <Circle cx={cx - headR * 0.33} cy={headY - headR * 0.08} r={headR * 0.18} fill="#1e293b" />
          <Circle cx={cx + headR * 0.33} cy={headY - headR * 0.08} r={headR * 0.18} fill="#1e293b" />
          {/* Eye whites / shines */}
          <Circle cx={cx - headR * 0.24} cy={headY - headR * 0.17} r={headR * 0.07} fill="#fff" />
          <Circle cx={cx + headR * 0.42} cy={headY - headR * 0.17} r={headR * 0.07} fill="#fff" />
          {/* Small secondary shine */}
          <Circle cx={cx - headR * 0.37} cy={headY - headR * 0.04} r={headR * 0.03} fill="rgba(255,255,255,0.5)" />
          <Circle cx={cx + headR * 0.29} cy={headY - headR * 0.04} r={headR * 0.03} fill="rgba(255,255,255,0.5)" />
          {/* Smile */}
          <Path
            d={`M${cx - headR * 0.38} ${headY + headR * 0.22}
                Q${cx} ${headY + headR * 0.6}
                ${cx + headR * 0.38} ${headY + headR * 0.22}`}
            stroke="#1e293b"
            strokeWidth={s * 0.028}
            fill="rgba(251,113,133,0.25)"
            strokeLinecap="round"
          />
          {/* Cheek blush */}
          <Ellipse cx={cx - headR * 0.62} cy={headY + headR * 0.22} rx={headR * 0.22} ry={headR * 0.12} fill="rgba(251,113,133,0.45)" />
          <Ellipse cx={cx + headR * 0.62} cy={headY + headR * 0.22} rx={headR * 0.22} ry={headR * 0.12} fill="rgba(251,113,133,0.45)" />
        </G>
      )}

      {expression === "cool" && (
        <G>
          {/* Sunglasses frame */}
          <Rect x={cx - headR * 0.62} y={headY - headR * 0.26} width={headR * 0.5}  height={headR * 0.35} rx={headR * 0.12} fill="#1e293b" />
          <Rect x={cx + headR * 0.12} y={headY - headR * 0.26} width={headR * 0.5}  height={headR * 0.35} rx={headR * 0.12} fill="#1e293b" />
          <Rect x={cx - headR * 0.12} y={headY - headR * 0.18} width={headR * 0.24} height={headR * 0.1}  rx={0} fill="#1e293b" />
          {/* Lens shine */}
          <Ellipse cx={cx - headR * 0.45} cy={headY - headR * 0.2} rx={headR * 0.1} ry={headR * 0.07} fill="rgba(255,255,255,0.2)" />
          <Ellipse cx={cx + headR * 0.29} cy={headY - headR * 0.2} rx={headR * 0.1} ry={headR * 0.07} fill="rgba(255,255,255,0.2)" />
          {/* Smirk */}
          <Path
            d={`M${cx - headR * 0.1} ${headY + headR * 0.35}
                Q${cx + headR * 0.28} ${headY + headR * 0.48}
                ${cx + headR * 0.38} ${headY + headR * 0.26}`}
            stroke="#1e293b" strokeWidth={s * 0.026} fill="none" strokeLinecap="round"
          />
        </G>
      )}

      {expression === "party" && (
        <G>
          {/* Star eyes */}
          <Circle cx={cx - headR * 0.33} cy={headY - headR * 0.08} r={headR * 0.18} fill="#f59e0b" />
          <Circle cx={cx + headR * 0.33} cy={headY - headR * 0.08} r={headR * 0.18} fill="#f59e0b" />
          <Circle cx={cx - headR * 0.24} cy={headY - headR * 0.17} r={headR * 0.07} fill="#fff" opacity={0.6} />
          <Circle cx={cx + headR * 0.42} cy={headY - headR * 0.17} r={headR * 0.07} fill="#fff" opacity={0.6} />
          {/* Big open smile */}
          <Path
            d={`M${cx - headR * 0.45} ${headY + headR * 0.18}
                Q${cx} ${headY + headR * 0.72}
                ${cx + headR * 0.45} ${headY + headR * 0.18}`}
            stroke="#1e293b" strokeWidth={s * 0.03} fill="rgba(251,113,133,0.4)" strokeLinecap="round"
          />
          {/* Cheeks */}
          <Ellipse cx={cx - headR * 0.64} cy={headY + headR * 0.22} rx={headR * 0.22} ry={headR * 0.12} fill="rgba(251,113,133,0.5)" />
          <Ellipse cx={cx + headR * 0.64} cy={headY + headR * 0.22} rx={headR * 0.22} ry={headR * 0.12} fill="rgba(251,113,133,0.5)" />
          {/* Party hat */}
          <Path
            d={`M${cx} ${headY - headR * 1.22}
                L${cx - headR * 0.32} ${headY - headR * 0.9}
                L${cx + headR * 0.32} ${headY - headR * 0.9} Z`}
            fill="#ec4899"
          />
          {/* Hat stripe */}
          <Path
            d={`M${cx - headR * 0.2} ${headY - headR * 1.0}
                L${cx + headR * 0.2} ${headY - headR * 1.0}`}
            stroke="#fde68a" strokeWidth={s * 0.018} strokeLinecap="round"
          />
          <Circle cx={cx} cy={headY - headR * 1.24} r={s * 0.032} fill="#fbbf24" />
        </G>
      )}

      {/* ── Outfit accessories ── */}

      {outfit === "knight" && (
        <G>
          {/* Chest plate */}
          <Rect x={bodyX + bodyW * 0.1} y={bodyTop + bodyH * 0.1} width={bodyW * 0.8} height={bodyH * 0.7} rx={bodyW * 0.2} fill="#9ca3af" opacity={0.7} />
          {/* Silver helmet */}
          <Rect x={cx - headR * 0.95} y={headY - headR * 1.05} width={headR * 1.9} height={headR * 1.3} rx={headR * 0.5} fill="#9ca3af" />
          {/* Visor slit */}
          <Rect x={cx - headR * 0.6} y={headY - headR * 0.15} width={headR * 1.2} height={headR * 0.2} rx={headR * 0.05} fill="#1e293b" />
          {/* Shine */}
          <Ellipse cx={cx - headR * 0.3} cy={headY - headR * 0.6} rx={headR * 0.15} ry={headR * 0.25} fill="rgba(255,255,255,0.3)" />
        </G>
      )}

      {outfit === "astronaut" && (
        <G>
          {/* NASA patch on body */}
          <Circle cx={cx + bodyW * 0.25} cy={bodyTop + bodyH * 0.35} r={bodyW * 0.12} fill="#1d4ed8" />
          <Circle cx={cx + bodyW * 0.25} cy={bodyTop + bodyH * 0.35} r={bodyW * 0.08} fill="#fff" />
          {/* Big dome over head */}
          <Circle cx={cx} cy={headY} r={headR * 1.18} fill="rgba(200,230,255,0.18)" stroke="#93c5fd" strokeWidth={s * 0.022} />
          {/* Dome shine */}
          <Ellipse
            cx={cx - headR * 0.35}
            cy={headY - headR * 0.5}
            rx={headR * 0.3}
            ry={headR * 0.18}
            fill="rgba(255,255,255,0.25)"
            transform={"rotate(-30, " + (cx - headR * 0.35) + ", " + (headY - headR * 0.5) + ")"}
          />
        </G>
      )}

      {outfit === "pirate" && (
        <G>
          {/* Tricorn hat */}
          <Path
            d={"M" + (cx - headR * 0.8) + " " + (headY - headR * 0.82) + " L" + cx + " " + (headY - headR * 1.55) + " L" + (cx + headR * 0.8) + " " + (headY - headR * 0.82) + " Q" + cx + " " + (headY - headR * 0.6) + " " + (cx - headR * 0.8) + " " + (headY - headR * 0.82) + " Z"}
            fill="#1c1917"
          />
          {/* Hat brim */}
          <Rect x={cx - headR * 1.0} y={headY - headR * 0.9} width={headR * 2.0} height={headR * 0.18} rx={headR * 0.09} fill="#292524" />
          {/* Eyepatch */}
          <Ellipse cx={cx - headR * 0.33} cy={headY - headR * 0.08} rx={headR * 0.22} ry={headR * 0.2} fill="#1c1917" />
          {/* Eyepatch string */}
          <Path
            d={"M" + (cx - headR * 0.55) + " " + (headY - headR * 0.28) + " L" + (cx - headR * 0.9) + " " + (headY - headR * 0.48)}
            stroke="#1c1917"
            strokeWidth={s * 0.015}
          />
        </G>
      )}

      {outfit === "ninja" && (
        <G>
          {/* Face mask covering lower half */}
          <Path
            d={"M" + (cx - headR * 0.85) + " " + (headY + headR * 0.05) + " Q" + cx + " " + (headY - headR * 0.1) + " " + (cx + headR * 0.85) + " " + (headY + headR * 0.05) + " L" + (cx + headR * 0.85) + " " + (headY + headR * 0.82) + " Q" + cx + " " + (headY + headR * 0.95) + " " + (cx - headR * 0.85) + " " + (headY + headR * 0.82) + " Z"}
            fill="#1e293b"
          />
          {/* Dark headband */}
          <Rect x={cx - headR * 0.95} y={headY - headR * 0.3} width={headR * 1.9} height={headR * 0.25} rx={headR * 0.12} fill="#1e293b" />
          {/* Headband knot */}
          <Ellipse cx={cx + headR * 0.85} cy={headY - headR * 0.18} rx={headR * 0.12} ry={headR * 0.08} fill="#1e293b" />
        </G>
      )}

      {outfit === "wizard" && (
        <G>
          {/* Stars on body */}
          <Circle cx={cx - bodyW * 0.1} cy={bodyTop + bodyH * 0.3} r={bodyW * 0.05} fill="#fbbf24" opacity={0.8} />
          <Circle cx={cx + bodyW * 0.15} cy={bodyTop + bodyH * 0.6} r={bodyW * 0.04} fill="#fbbf24" opacity={0.7} />
          <Circle cx={cx - bodyW * 0.2} cy={bodyTop + bodyH * 0.65} r={bodyW * 0.035} fill="#fbbf24" opacity={0.6} />
          {/* Hat brim */}
          <Rect x={cx - headR * 1.0} y={headY - headR * 0.95} width={headR * 2.0} height={headR * 0.2} rx={headR * 0.1} fill="#581c87" />
          {/* Tall pointy hat */}
          <Path
            d={"M" + cx + " " + (headY - headR * 2.0) + " L" + (cx - headR * 0.75) + " " + (headY - headR * 0.85) + " L" + (cx + headR * 0.75) + " " + (headY - headR * 0.85) + " Z"}
            fill="#581c87"
          />
          {/* Star on hat */}
          <Circle cx={cx} cy={headY - headR * 1.5} r={headR * 0.12} fill="#fbbf24" />
          {/* Moon on hat */}
          <Circle cx={cx - headR * 0.3} cy={headY - headR * 1.2} r={headR * 0.09} fill="#fbbf24" opacity={0.7} />
        </G>
      )}

      {outfit === "dino" && (
        <G>
          {/* Green spikes along top of head */}
          <Path d={"M" + (cx - headR * 0.6) + " " + (headY - headR * 0.92) + " L" + (cx - headR * 0.45) + " " + (headY - headR * 1.35) + " L" + (cx - headR * 0.3) + " " + (headY - headR * 0.92)} fill="#4ade80" />
          <Path d={"M" + (cx - headR * 0.3) + " " + (headY - headR * 0.96) + " L" + (cx - headR * 0.15) + " " + (headY - headR * 1.42) + " L" + cx + " " + (headY - headR * 0.96)} fill="#4ade80" />
          <Path d={"M" + cx + " " + (headY - headR * 0.98) + " L" + (cx + headR * 0.15) + " " + (headY - headR * 1.45) + " L" + (cx + headR * 0.3) + " " + (headY - headR * 0.98)} fill="#4ade80" />
          <Path d={"M" + (cx + headR * 0.3) + " " + (headY - headR * 0.96) + " L" + (cx + headR * 0.45) + " " + (headY - headR * 1.38) + " L" + (cx + headR * 0.6) + " " + (headY - headR * 0.96)} fill="#4ade80" />
          <Path d={"M" + (cx + headR * 0.55) + " " + (headY - headR * 0.9) + " L" + (cx + headR * 0.68) + " " + (headY - headR * 1.25) + " L" + (cx + headR * 0.8) + " " + (headY - headR * 0.9)} fill="#4ade80" />
        </G>
      )}

      {outfit === "angel" && (
        <G>
          {/* Halo above head */}
          <Ellipse cx={cx} cy={headY - headR * 1.15} rx={headR * 0.55} ry={headR * 0.14} fill="none" stroke="#fbbf24" strokeWidth={s * 0.032} />
        </G>
      )}

      {outfit === "devil" && (
        <G>
          {/* Left horn */}
          <Path
            d={"M" + (cx - headR * 0.4) + " " + (headY - headR * 0.88) + " L" + (cx - headR * 0.25) + " " + (headY - headR * 1.4) + " L" + (cx - headR * 0.1) + " " + (headY - headR * 0.88)}
            fill="#ef4444"
          />
          {/* Right horn */}
          <Path
            d={"M" + (cx + headR * 0.1) + " " + (headY - headR * 0.88) + " L" + (cx + headR * 0.25) + " " + (headY - headR * 1.4) + " L" + (cx + headR * 0.4) + " " + (headY - headR * 0.88)}
            fill="#ef4444"
          />
          {/* Pitchfork — simple lines held in right hand */}
          <Path
            d={"M" + (bodyX + bodyW + s * 0.06) + " " + (bodyTop + bodyH * 0.3) + " L" + (bodyX + bodyW + s * 0.06) + " " + (bodyTop + bodyH * 0.9)}
            stroke="#ef4444"
            strokeWidth={s * 0.025}
            strokeLinecap="round"
          />
          <Path
            d={"M" + (bodyX + bodyW + s * 0.02) + " " + (bodyTop + bodyH * 0.3) + " L" + (bodyX + bodyW + s * 0.02) + " " + (bodyTop + bodyH * 0.5)}
            stroke="#ef4444"
            strokeWidth={s * 0.018}
            strokeLinecap="round"
          />
          <Path
            d={"M" + (bodyX + bodyW + s * 0.1) + " " + (bodyTop + bodyH * 0.3) + " L" + (bodyX + bodyW + s * 0.1) + " " + (bodyTop + bodyH * 0.5)}
            stroke="#ef4444"
            strokeWidth={s * 0.018}
            strokeLinecap="round"
          />
        </G>
      )}

      {outfit === "robot" && (
        <G>
          {/* Bolts on sides of head */}
          <Circle cx={cx - headR * 0.9} cy={headY} r={headR * 0.08} fill="#94a3b8" />
          <Circle cx={cx + headR * 0.9} cy={headY} r={headR * 0.08} fill="#94a3b8" />
          {/* Metal visor over eyes */}
          <Rect x={cx - headR * 0.7} y={headY - headR * 0.28} width={headR * 1.4} height={headR * 0.38} rx={headR * 0.1} fill="rgba(14,165,233,0.55)" />
          {/* Grid line on visor */}
          <Path
            d={"M" + cx + " " + (headY - headR * 0.28) + " L" + cx + " " + (headY + headR * 0.1)}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={s * 0.01}
          />
          {/* Antenna */}
          <Rect x={cx - s * 0.012} y={headY - headR * 1.6} width={s * 0.024} height={headR * 0.55} rx={s * 0.01} fill="#94a3b8" />
          <Circle cx={cx} cy={headY - headR * 1.62} r={s * 0.035} fill="#ef4444" />
        </G>
      )}
    </Svg>
  );
}

// ── Color helpers ──────────────────────────────────────────────────────────────
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, amt: number): string {
  return lighten(hex, -amt);
}
