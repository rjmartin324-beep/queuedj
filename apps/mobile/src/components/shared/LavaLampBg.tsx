import React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// WebView only imported on native — web gets a static gradient fallback
let WebView: any = null;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lava Lamp Background
//
// Renders an HTML5 canvas metaball lava-lamp animation via WebView (native)
// or a deep purple gradient (web preview). The canvas is rendered at 60% of
// screen resolution and upscaled smoothly for GPU headroom.
//
// Palette is fixed to PartyGlue brand purple — the canvas is transparent to
// the overlaid UI via pointerEvents="none".
// ─────────────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden;background:#030008}
  canvas{display:block;width:100%;height:100%;touch-action:none}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const cv = document.getElementById('c');
const ct = cv.getContext('2d');
let W, H, off, oc;
const RES = 0.55; // render at 55%, upscale — saves ~70% pixel work

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  cv.width  = W; cv.height  = H;
  ct.imageSmoothingEnabled = true;
  ct.imageSmoothingQuality = 'high';
  off = document.createElement('canvas');
  off.width  = Math.ceil(W * RES);
  off.height = Math.ceil(H * RES);
  oc = off.getContext('2d');
}
resize();
window.addEventListener('resize', resize);

// ── Palette: PartyGlue deep purple ──────────────────────────────────────────
const PAL = {
  hot:  [220, 80, 255],   // bright violet-white
  mid:  [155, 20, 220],   // core purple
  cool: [55,   4, 110],   // deep indigo
  pool: [100, 10, 180],   // pool surface
  bg:   [3,   0,   8],    // void background
};

function lerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t | 0,
    a[1] + (b[1] - a[1]) * t | 0,
    a[2] + (b[2] - a[2]) * t | 0,
  ];
}
function tempColor(t) {
  if (t > 0.65) return lerp(PAL.mid, PAL.hot, (t - 0.65) / 0.35);
  if (t > 0.2)  return lerp(PAL.cool, PAL.mid, (t - 0.2) / 0.45);
  return PAL.cool;
}

// ── Pool surface ─────────────────────────────────────────────────────────────
class Pool {
  constructor() { this.ph = 0; }
  update(ts) { this.ph = ts * 0.00042; }
  surfY(px) {
    const nx = px / W;
    return H * 0.83
      + Math.sin(nx * Math.PI * 2.1 + this.ph)       * 8
      + Math.sin(nx * Math.PI * 3.8 + this.ph * 1.5) * 3.5
      + Math.sin(nx * Math.PI * 1.2 - this.ph * 0.8) * 2.5;
  }
  field(px, py) {
    return 1.55 / (1 + Math.exp(-(py - this.surfY(px)) * 0.10));
  }
}

// ── Blob ──────────────────────────────────────────────────────────────────────
class Blob {
  constructor(pool) {
    this.pool = pool;
    this.x  = W * 0.12 + Math.random() * W * 0.76;
    this.y  = pool.surfY(this.x);
    this.r  = 0;
    const roll = Math.random();
    this.targetR = roll < 0.55
      ? 20 + Math.random() * 22   // small
      : roll < 0.88
        ? 42 + Math.random() * 20  // medium
        : 62 + Math.random() * 14; // large (rare)
    this.vy   = 0;
    this.vx   = 0;
    this.state = 'FORMING';
    this.dph  = Math.random() * Math.PI * 2;
    this.dfr  = 0.00042 + Math.random() * 0.00038;
    this.alpha = 1;
    this.temp  = 1;
    this.peakY = H * 0.04 + Math.random() * H * 0.24;
    this.dead  = false;
  }

  field(px, py) {
    const dx = px - this.x, dy = py - this.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 0.01) return 99;
    return (this.r * this.r / d2) * this.alpha;
  }

  update(ts, dt) {
    const surf = this.pool.surfY(this.x);

    if (this.state === 'FORMING') {
      this.r += (this.targetR - this.r) * 0.020;
      this.y  = surf - this.r * 0.45;
      this.temp = 1;
      if (this.r > this.targetR * 0.88) {
        this.state = 'RISING';
        this.vy = -0.85 - Math.random() * 0.40;
      }
    }
    else if (this.state === 'RISING') {
      this.vy += (-0.005 - this.vy * 0.010) * dt * 0.075;
      this.vy  = Math.max(this.vy, -1.05);
      this.y  += this.vy * dt * 0.075;
      this.vx  = Math.sin(ts * this.dfr + this.dph) * 0.18;
      this.x  += this.vx * dt * 0.075;
      this.x   = Math.max(this.r + 10, Math.min(W - this.r - 10, this.x));
      this.temp = Math.max(0.08, this.temp - 0.00011 * dt);
      if (this.y <= this.peakY) { this.vy = 0; this.state = 'COOLING'; }
    }
    else if (this.state === 'COOLING') {
      this.y += Math.sin(ts * 0.00065 + this.dph) * 0.18;
      this.x += Math.sin(ts * this.dfr + this.dph) * 0.10;
      this.x  = Math.max(this.r + 10, Math.min(W - this.r - 10, this.x));
      this.temp = Math.max(0, this.temp - 0.00020 * dt);
      if (this.temp < 0.04) { this.state = 'SINKING'; this.vy = 0.05; }
    }
    else if (this.state === 'SINKING') {
      this.vy += 0.013 * dt * 0.075;
      this.vy  = Math.min(this.vy, 0.95);
      this.y  += this.vy * dt * 0.075;
      this.x  += Math.sin(ts * this.dfr + this.dph) * 0.08;
      this.x   = Math.max(this.r + 10, Math.min(W - this.r - 10, this.x));
      this.temp = Math.min(0.55, this.temp + 0.00009 * dt);
      if (this.y + this.r * 0.35 > surf - 6) this.state = 'ABSORBING';
    }
    else if (this.state === 'ABSORBING') {
      this.y += this.vy * dt * 0.075;
      this.vy += 0.018 * dt * 0.075;
      this.r  *= Math.pow(0.960, dt * 0.1);
      this.temp = Math.min(1, this.temp + 0.004 * dt);
      if (this.r < 6) this.alpha = Math.max(0, this.alpha - 0.06 * dt * 0.1);
      if (this.alpha <= 0 || this.r < 0.5) this.dead = true;
    }
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
const pool  = new Pool();
let blobs   = [];
let lastSpawn = -9999;

function renderMeta() {
  const OW = off.width, OH = off.height;
  const sx = RES, sy = RES;
  const img = oc.createImageData(OW, OH);
  const d   = img.data;
  const bg  = PAL.bg;
  const pc  = PAL.pool;

  for (let oy = 0; oy < OH; oy++) {
    const py = oy / sy;
    for (let ox = 0; ox < OW; ox++) {
      const px  = ox / sx;
      let v     = pool.field(px, py);
      let hSum  = 0, bSum = 0;
      for (const b of blobs) {
        const bf = b.field(px, py);
        if (bf < 0.001) continue;
        v += bf; hSum += bf * b.temp; bSum += bf;
      }
      const idx = (oy * OW + ox) * 4;

      if (v >= 1.0) {
        let col;
        if (bSum < 0.01) {
          col = pc;
        } else {
          const tc  = Math.min(1, hSum / Math.max(0.001, bSum));
          const bC  = tempColor(tc);
          const pw  = Math.min(1, pool.field(px, py) / v);
          col = lerp(bC, pc, pw * 0.50);
        }
        d[idx]   = col[0];
        d[idx+1] = col[1];
        d[idx+2] = col[2];
        d[idx+3] = 255;
      } else {
        // Subtle glow halo outside blobs
        const glow = Math.max(0, v - 0.15) * 0.5;
        d[idx]   = (bg[0] + PAL.cool[0] * glow * 0.6) | 0;
        d[idx+1] = (bg[1] + PAL.cool[1] * glow * 0.6) | 0;
        d[idx+2] = (bg[2] + PAL.cool[2] * glow * 0.7) | 0;
        d[idx+3] = 255;
      }
    }
  }
  oc.putImageData(img, 0, 0);
  ct.drawImage(off, 0, 0, W, H);
}

function drawHighlights() {
  for (const b of blobs) {
    if (b.r < 6 || b.alpha < 0.05) continue;
    const hx = b.x - b.r * 0.26, hy = b.y - b.r * 0.27;
    const g  = ct.createRadialGradient(hx, hy, 1, hx, hy, b.r * 0.44);
    const op = Math.min(0.50, 0.38 * b.alpha * Math.max(0.12, b.temp));
    g.addColorStop(0, \`rgba(245,220,255,\${op.toFixed(2)})\`);
    g.addColorStop(1, 'rgba(200,160,255,0)');
    ct.beginPath();
    ct.arc(hx, hy, b.r * 0.44, 0, Math.PI * 2);
    ct.fillStyle = g;
    ct.fill();
  }
}

function drawVignette() {
  // Top readability fade
  const tg = ct.createLinearGradient(0, 0, 0, H * 0.22);
  tg.addColorStop(0, 'rgba(2,0,10,0.72)');
  tg.addColorStop(1, 'rgba(2,0,10,0)');
  ct.fillStyle = tg;
  ct.fillRect(0, 0, W, H * 0.22);

  // Subtle glass sheen on left edge
  const gg = ct.createLinearGradient(0, 0, W * 0.10, 0);
  gg.addColorStop(0, 'rgba(255,255,255,0.048)');
  gg.addColorStop(1, 'rgba(255,255,255,0)');
  ct.fillStyle = gg;
  ct.fillRect(0, 0, W * 0.10, H);
}

let last = 0;
function loop(ts) {
  const dt = Math.min(ts - last, 50);
  last = ts;
  pool.update(ts);

  if (ts - lastSpawn > 2000 && blobs.length < 8) {
    blobs.push(new Blob(pool));
    lastSpawn = ts;
  }
  if (blobs.length === 0 && ts > 100) {
    blobs.push(new Blob(pool));
    lastSpawn = ts;
  }
  blobs = blobs.filter(b => { b.update(ts, dt); return !b.dead; });

  renderMeta();
  drawHighlights();
  drawVignette();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script>
</body>
</html>`;

export function LavaLampBg() {
  if (Platform.OS === "web") {
    // On web use a raw iframe — same HTML, full animation, no WebView needed
    return React.createElement("iframe", {
      srcDoc: HTML,
      style: {
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
        pointerEvents: "none",
        zIndex: 0,
      },
    } as any);
  }

  if (!WebView) {
    return (
      <LinearGradient
        colors={["#030008", "#0d0030", "#1a0050", "#0a0020"]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        source={{ html: HTML }}
        style={StyleSheet.absoluteFill}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        androidLayerType="hardware"
        javaScriptEnabled
        originWhitelist={["*"]}
      />
    </View>
  );
}
