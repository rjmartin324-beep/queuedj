#!/usr/bin/env node
// wikipedia-lead-image.mjs
//
// Fetches the LEAD IMAGE of each landmark's Wikipedia article. The lead image
// is curated by editors as the canonical representative photo of the subject,
// so quality is far better than geosearch or category browse.
//
// Reads `apps/box-client/scripts/wikipedia-titles.json` mapping id → article
// title (e.g. "Eiffel Tower"), fetches the lead image via the REST summary
// endpoint, downloads it, and overwrites geo_NNN.jpg.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TITLES = JSON.parse(fs.readFileSync(path.resolve(__dirname, "wikipedia-titles.json"), "utf8"));
const OUT_DIR = path.resolve(__dirname, "../public/geo-photos");
const UA = "PartyGlueBox/0.1 (offline party game; rjmartin324@gmail.com)";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      const key = cur.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith("--") ? next : true]);
    }
    return acc;
  }, []),
);
const explicitIds = args.ids ? String(args.ids).split(",").map(s => parseInt(s.trim(), 10)).filter(Number.isFinite) : null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Convert a Wikimedia Commons original-image URL to a thumb URL at the given
// width. Caps file size while keeping image quality high enough for an HD8.
//   in:  https://upload.wikimedia.org/wikipedia/commons/3/3c/Eiffel.jpg
//   out: https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Eiffel.jpg/1200px-Eiffel.jpg
function thumbify(url, width = 1200) {
  if (!url) return url;
  if (url.includes("/thumb/")) return url;  // already a thumb
  const m = url.match(/^(.*\/commons)\/([0-9a-f]\/[0-9a-f]{2})\/(.+?)$/);
  if (!m) return url;
  const [, prefix, hash, filename] = m;
  return `${prefix}/thumb/${hash}/${filename}/${width}px-${filename}`;
}

async function leadImageUrl(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Wikipedia ${r.status}`);
  const j = await r.json();
  // Prefer originalimage transformed to a 1200px thumb (~300-600KB JPEGs)
  const orig = j.originalimage?.source ?? j.thumbnail?.source;
  return thumbify(orig, 1200);
}

async function downloadJpg(url, outPath) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

async function main() {
  const ids = Object.keys(TITLES).map(Number).filter(id => {
    if (explicitIds) return explicitIds.includes(id);
    return true;
  }).sort((a, b) => a - b);

  let ok = 0, fail = 0;
  for (const id of ids) {
    const num = String(id).padStart(3, "0");
    const outPath = path.join(OUT_DIR, `geo_${num}.jpg`);
    const title = TITLES[String(id)];
    try {
      const imgUrl = await leadImageUrl(title);
      if (!imgUrl) { console.log(`#${num} ✗ ${title}: no lead image`); fail++; await sleep(500); continue; }
      const bytes = await downloadJpg(imgUrl, outPath);
      console.log(`#${num} ✓ ${title} (${(bytes/1024).toFixed(0)} KB)`);
      ok++;
    } catch (e) {
      console.log(`#${num} ✗ ${title}: ${e.message}`);
      fail++;
    }
    await sleep(2000);  // 2s between requests to stay under Wikipedia rate limit
  }
  console.log(`\n${ok} ok / ${fail} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
