#!/usr/bin/env node
// download-geo-photos.mjs
//
// Walks geo-manifest.json, queries Wikimedia Commons for a geotagged JPG near
// each (lat, lng), downloads it at 1200px wide, and writes attribution to
// PHOTO_CREDITS.txt.
//
// USAGE (from apps/box-client):
//   node scripts/download-geo-photos.mjs
//   node scripts/download-geo-photos.mjs --start 0 --end 60   (range)
//   node scripts/download-geo-photos.mjs --skip-existing      (resume after crash)
//
// REQUIREMENTS: dev-machine internet. Tablet stays offline.
// OUTPUT: apps/box-client/public/geo-photos/geo_NNN.jpg + PHOTO_CREDITS.txt

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(__dirname, "../src/seed/geo-manifest.json");
const OUT_DIR = path.resolve(__dirname, "../public/geo-photos");
const CREDITS = path.resolve(OUT_DIR, "PHOTO_CREDITS.txt");
const UA = "PartyGlueBox/0.1 (https://partyglue.local; offline party game; rjmartin324@gmail.com) node";

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
const START = parseInt(args.start ?? "0", 10);
const END = parseInt(args.end ?? "9999", 10);
const SKIP_EXISTING = !!args["skip-existing"];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(params) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Wikimedia API ${r.status}`);
  return r.json();
}

async function geosearch(lat, lng, radiusM = 5000, limit = 30) {
  const j = await api({
    action: "query",
    list: "geosearch",
    gscoord: `${lat}|${lng}`,
    gsradius: String(radiusM),
    gslimit: String(limit),
    gsnamespace: "6",   // File: namespace
    gsprop: "type|name",
  });
  return (j.query?.geosearch ?? []).map(x => x.title);
}

async function imageInfo(titles) {
  if (!titles.length) return [];
  const j = await api({
    action: "query",
    titles: titles.join("|"),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1200",
  });
  const pages = Object.values(j.query?.pages ?? {});
  const rows = [];
  for (const p of pages) {
    const ii = (p.imageinfo ?? [])[0];
    if (!ii) continue;
    rows.push({
      title: p.title,
      thumbUrl: ii.thumburl,
      origUrl: ii.url,
      width: ii.thumbwidth ?? ii.width,
      height: ii.thumbheight ?? ii.height,
      mime: ii.mime,
      author: stripHtml(ii.extmetadata?.Artist?.value ?? "?"),
      license: ii.extmetadata?.LicenseShortName?.value ?? "?",
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
    });
  }
  return rows;
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, "").trim().slice(0, 120);
}

async function downloadJpg(url, outPath) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

function pickBest(rows, entry) {
  // Score: prefer JPEG, landscape, ≥800 wide, license that is CC/PD/free.
  const ok = rows.filter(r =>
    /jpeg|jpg/i.test(r.mime ?? "") &&
    (r.width ?? 0) >= 800 &&
    (r.height ?? 0) > 0 &&
    (r.width ?? 0) >= (r.height ?? 1) &&
    /(CC|Public domain|PD|GFDL|FAL)/i.test(r.license ?? "")
  );
  if (ok.length === 0) return null;
  // Prefer ones whose title contains the search term
  const term = (entry.wikimedia_search ?? entry.location ?? "").toLowerCase();
  const ranked = ok.map(r => ({
    r,
    score: (r.title.toLowerCase().includes(term.split(" ")[0] ?? "") ? 100 : 0) + (r.width ?? 0),
  })).sort((a, b) => b.score - a.score);
  return ranked[0].r;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const credits = [];
  let okCount = 0, skip = 0, fail = 0;

  for (const entry of manifest) {
    if (entry.id < START || entry.id > END) continue;
    const num = String(entry.id).padStart(3, "0");
    const outPath = path.join(OUT_DIR, `geo_${num}.jpg`);
    if (SKIP_EXISTING && fs.existsSync(outPath) && fs.statSync(outPath).size > 10_000) {
      console.log(`#${num} ✓ skip (exists) — ${entry.location}`);
      skip++; continue;
    }
    try {
      console.log(`#${num} ${entry.location} (${entry.country})`);
      const titles = await geosearch(entry.lat, entry.lng, 5000, 30);
      if (!titles.length) {
        console.log(`  → no nearby files; widening radius`);
        const wide = await geosearch(entry.lat, entry.lng, 25000, 30);
        if (!wide.length) { console.log(`  ✗ NO RESULTS`); fail++; await sleep(400); continue; }
        titles.push(...wide);
      }
      const rows = await imageInfo(titles.slice(0, 15));
      const best = pickBest(rows, entry);
      if (!best) { console.log(`  ✗ no acceptable image found`); fail++; await sleep(400); continue; }
      const bytes = await downloadJpg(best.thumbUrl, outPath);
      console.log(`  ✓ ${best.title} (${(bytes / 1024).toFixed(0)} KB) — ${best.license}`);
      credits.push(`#${num} ${entry.location}\n  file: ${path.basename(outPath)}\n  source: ${best.sourceUrl}\n  author: ${best.author}\n  license: ${best.license}\n`);
      okCount++;
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
      fail++;
    }
    await sleep(350);  // be polite to Wikimedia
  }

  fs.writeFileSync(CREDITS, [
    "PartyGlue Box — GeoGuesser photo credits",
    `Generated: ${new Date().toISOString()}`,
    `Photos: ${okCount} downloaded, ${skip} skipped, ${fail} failed`,
    "",
    ...credits,
  ].join("\n"), "utf8");

  console.log(`\nDone. ${okCount} ok / ${skip} skipped / ${fail} failed.`);
  console.log(`Credits: ${CREDITS}`);
}

main().catch(err => { console.error(err); process.exit(1); });
