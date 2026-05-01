#!/usr/bin/env node
// Fetch candidate photos from Wikimedia Commons for a given search query.
// Downloads top N results to a staging dir as candidate-1.jpg ... candidate-N.jpg
// for visual review. Does NOT replace any manifest entries — that's a manual
// step after eyeballing.
//
// Usage:
//   node fetch-geo-candidate.mjs "Havana Old Town Malecon" /tmp/wb-fetch 4

import fs from "node:fs";
import path from "node:path";
import { writeFileSync } from "node:fs";

const [, , query, dirArg, limitArg] = process.argv;
if (!query) {
  console.error("usage: node fetch-geo-candidate.mjs '<search query>' [outDir] [limit]");
  process.exit(1);
}
const outDir = dirArg ?? "/tmp/wb-fetch";
const limit = parseInt(limitArg ?? "4", 10);

fs.mkdirSync(outDir, { recursive: true });

async function main() {
  // 1. Search file namespace for matches.
  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srsearch", query);
  searchUrl.searchParams.set("srnamespace", "6"); // File namespace
  searchUrl.searchParams.set("srlimit", String(limit * 3)); // over-fetch, filter to JPG/PNG
  searchUrl.searchParams.set("origin", "*");
  const headers = { "User-Agent": "PartyGlue-Box/1.0 (geo-fetch helper)" };

  const sr = await fetch(searchUrl, { headers });
  if (!sr.ok) throw new Error(`search HTTP ${sr.status}`);
  const sd = await sr.json();
  const titles = (sd.query?.search ?? [])
    .map(h => h.title)
    .filter(t => /\.(jpe?g|png)$/i.test(t)); // skip SVGs/PDFs
  console.log(`[search] ${titles.length} JPG/PNG hits for "${query}"`);

  // 2. For each candidate (up to limit), get the actual download URL via
  //    iiurlwidth so we get a 1200-wide thumbnail (smaller download).
  const picked = titles.slice(0, limit);
  const lines = [];
  for (let i = 0; i < picked.length; i++) {
    const title = picked[i];
    const infoUrl = new URL("https://commons.wikimedia.org/w/api.php");
    infoUrl.searchParams.set("action", "query");
    infoUrl.searchParams.set("format", "json");
    infoUrl.searchParams.set("titles", title);
    infoUrl.searchParams.set("prop", "imageinfo");
    infoUrl.searchParams.set("iiprop", "url");
    infoUrl.searchParams.set("iiurlwidth", "1200");
    infoUrl.searchParams.set("origin", "*");
    const ir = await fetch(infoUrl, { headers });
    const id = await ir.json();
    const pages = id.query?.pages ?? {};
    const first = Object.values(pages)[0];
    const ii = first?.imageinfo?.[0];
    if (!ii?.thumburl) { console.log(`  [${i+1}] ${title} — no thumb`); continue; }
    const thumbUrl = ii.thumburl;

    const dest = path.join(outDir, `candidate-${i+1}.jpg`);
    const dr = await fetch(thumbUrl, { headers });
    if (!dr.ok) { console.log(`  [${i+1}] download HTTP ${dr.status}`); continue; }
    const buf = Buffer.from(await dr.arrayBuffer());
    writeFileSync(dest, buf);
    lines.push(`  [${i+1}] ${title} -> ${dest} (${(buf.length/1024).toFixed(0)} KB)`);
  }
  for (const l of lines) console.log(l);
  console.log(`Wrote ${picked.length} candidates to ${outDir}/`);
}
main().catch(e => { console.error(e); process.exit(1); });
