#!/usr/bin/env node
// download-world-map.mjs — fetches a flat world SVG (Wikimedia Commons,
// public domain) and saves to apps/box-client/public/world.svg
//
// Resolves the file URL via the Wikimedia API so we don't hardcode a
// hash-path that drifts.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../public/world.svg");
const UA = "PartyGlueBox/0.1 (offline party game; rjmartin324@gmail.com) node";

// First filename that resolves wins. All public domain or CC0.
const CANDIDATES = [
  "File:BlankMap-World.svg",
  "File:BlankMap-World-Equirectangular.svg",
  "File:BlankMap-World6.svg",
  "File:BlankMap-World-noborders.svg",
];

async function resolveUrl(title) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", title);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|mime");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const j = await r.json();
  const pages = Object.values(j.query?.pages ?? {});
  for (const p of pages) {
    const ii = (p.imageinfo ?? [])[0];
    if (ii?.url) return { url: ii.url, mime: ii.mime, title: p.title };
  }
  return null;
}

async function main() {
  console.log("Resolving world map URL via Wikimedia API…");
  let resolved = null;
  for (const c of CANDIDATES) {
    try {
      const r = await resolveUrl(c);
      if (r) { resolved = r; console.log(`  → ${r.title}\n  → ${r.url}`); break; }
    } catch (e) {
      console.log(`  ${c}: ${e.message}`);
    }
  }
  if (!resolved) {
    console.error("Could not resolve a world map file. Try opening commons.wikimedia.org/wiki/Category:World_maps and picking a file by hand.");
    process.exit(1);
  }

  console.log("Downloading…");
  const dl = await fetch(resolved.url, { headers: { "User-Agent": UA } });
  if (!dl.ok) throw new Error(`download ${dl.status}`);
  const text = await dl.text();
  if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text, "utf8");
  console.log(`Saved ${(text.length / 1024).toFixed(1)} KB → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
