#!/usr/bin/env node
// redownload-by-title.mjs
//
// Replaces all geo_NNN.jpg with explicitly named Wikimedia files from
// scripts/geo-curated-titles.json. Falls through candidates in order. If
// nothing in the curated list resolves, leaves the existing file alone (so
// the previous geosearch result remains as a fallback).
//
// USAGE:
//   node scripts/redownload-by-title.mjs                 (all ids)
//   node scripts/redownload-by-title.mjs --ids 10,78     (specific ids)
//   node scripts/redownload-by-title.mjs --start 1 --end 60   (range)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TITLES = JSON.parse(fs.readFileSync(path.resolve(__dirname, "geo-curated-titles.json"), "utf8")).titles;
const OUT_DIR = path.resolve(__dirname, "../public/geo-photos");
const CREDITS = path.resolve(OUT_DIR, "PHOTO_CREDITS.txt");
const UA = "PartyGlueBox/0.1 (offline party game; rjmartin324@gmail.com) node";

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
const START = parseInt(args.start ?? "1", 10);
const END = parseInt(args.end ?? "9999", 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(params) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

async function resolveTitle(title) {
  const j = await api({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1200",
  });
  const page = Object.values(j.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined || !page.imageinfo) return null;
  const ii = page.imageinfo[0];
  if (!/jpe?g/i.test(ii.mime ?? "")) return null;
  if (!ii.thumburl && !ii.url) return null;
  return {
    title: page.title,
    thumbUrl: ii.thumburl || ii.url,
    width: ii.thumbwidth ?? ii.width,
    height: ii.thumbheight ?? ii.height,
    license: ii.extmetadata?.LicenseShortName?.value ?? "?",
    author: stripHtml(ii.extmetadata?.Artist?.value ?? "?"),
    sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
  };
}

function stripHtml(s) { return String(s).replace(/<[^>]+>/g, "").trim().slice(0, 120); }

async function downloadJpg(url, outPath) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

async function main() {
  const credits = [];
  let okCount = 0, skipped = 0, failed = 0;

  const ids = Object.keys(TITLES).map(Number).filter(id => {
    if (explicitIds) return explicitIds.includes(id);
    return id >= START && id <= END;
  }).sort((a, b) => a - b);

  for (const id of ids) {
    const num = String(id).padStart(3, "0");
    const outPath = path.join(OUT_DIR, `geo_${num}.jpg`);
    const candidates = TITLES[String(id)] ?? [];
    if (candidates.length === 0) { skipped++; continue; }

    let resolved = null;
    for (const t of candidates) {
      try {
        const r = await resolveTitle(t);
        if (r) { resolved = r; break; }
      } catch { /* try next */ }
      await sleep(120);
    }

    if (!resolved) {
      console.log(`#${num} ✗ none of ${candidates.length} candidates resolved`);
      failed++;
      await sleep(200);
      continue;
    }

    try {
      const bytes = await downloadJpg(resolved.thumbUrl, outPath);
      console.log(`#${num} ✓ ${resolved.title} (${(bytes / 1024).toFixed(0)} KB) — ${resolved.license}`);
      credits.push(`#${num}\n  file: geo_${num}.jpg\n  source: ${resolved.sourceUrl}\n  author: ${resolved.author}\n  license: ${resolved.license}\n`);
      okCount++;
    } catch (err) {
      console.log(`#${num} ✗ ${err.message}`);
      failed++;
    }
    await sleep(250);
  }

  // Append credits (preserve previous credits file by appending a marker)
  fs.appendFileSync(CREDITS, [
    "",
    "==== CURATED REDOWNLOAD ====",
    `Run: ${new Date().toISOString()}`,
    `${okCount} ok / ${skipped} skipped / ${failed} failed`,
    "",
    ...credits,
  ].join("\n"), "utf8");

  console.log(`\n${okCount} downloaded, ${failed} failed, ${skipped} skipped (no candidates).`);
}

main().catch(e => { console.error(e); process.exit(1); });
