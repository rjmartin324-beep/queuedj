#!/usr/bin/env node
// category-fix.mjs
// For ids that didn't get a curated download, search Wikimedia categories by
// landmark name and grab the first wide JPEG. Categories are curated lists OF
// the landmark (not coincidentally near it), so quality is far higher than
// raw geosearch.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(__dirname, "../src/seed/geo-manifest.json");
const OUT_DIR = path.resolve(__dirname, "../public/geo-photos");
const UA = "PartyGlueBox/0.1 (offline party game)";

// id → Wikimedia Commons category page (without "Category:" prefix)
const CATEGORIES = {
  74: "Reine, Lofoten",
  83: "Quebec City",
  85: "Forbidden City",
  86: "Tokyo Tower",
  87: "Marina Bay Sands",
  88: "Petronas Towers",
  91: "Tiger's Nest Monastery",
  93: "Yellow Pumpkin (Naoshima)",
  94: "Padar Island",
  95: "Imperial City of Huế",
  96: "Iguazu Falls",
  97: "Torres del Paine National Park",
  98: "Cotopaxi",
  103: "Avenue of the Baobabs",
  104: "Skeleton Coast",
  105: "Pyramids of Meroe",
  106: "Uluru",
  107: "Twelve Apostles, Victoria",
  108: "Milford Sound",
  109: "Bora Bora",
  110: "Burj Al Arab",
  112: "Persepolis",
  113: "Hegra",
  114: "Liwa Oasis",
  115: "Antarctic Peninsula",
  117: "Nuuk",
  119: "Salt Cathedral of Zipaquirá",
  120: "Plain of Jars",
  // also retry these from the first pass with a category fallback
  31: "Sossusvlei",
  37: "Vestmanna",
  39: "Altai Mountains",
  40: "Tassili n'Ajjer",
  41: "Tongariro Alpine Crossing",
  42: "Dragon's Blood Tree",
  44: "Dallol",
  45: "Kerguelen Islands",
  46: "Shangri-La City",
  47: "Salar de Uyuni",
  48: "Darvaza gas crater",
  53: "Maasai Mara",
  54: "El Nido, Palawan",
  60: "Zhangye Danxia Geopark",
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(params) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

async function categoryFiles(category) {
  const j = await api({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${category}`,
    cmtype: "file",
    cmlimit: "30",
  });
  return (j.query?.categorymembers ?? []).map(m => m.title);
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
  return Object.values(j.query?.pages ?? {}).map(p => {
    const ii = (p.imageinfo ?? [])[0];
    if (!ii) return null;
    return {
      title: p.title,
      thumbUrl: ii.thumburl || ii.url,
      width: ii.thumbwidth ?? ii.width,
      height: ii.thumbheight ?? ii.height,
      mime: ii.mime,
      license: ii.extmetadata?.LicenseShortName?.value ?? "?",
    };
  }).filter(Boolean);
}

function pickBest(rows) {
  // Filter OUT obvious junk: satellite imagery, maps, stamps, museum shots,
  // generic ISS earth views — anything that's not actually OF the landmark.
  const REJECT_TITLE = /(landsat|sentinel|spot ?[5-9]|isspictur|iss \d|terra mod|sat[ -]image|stamp\b|coin\b|map of|locator|topographic|seal of|coat of arms|portrait of|painting of|silhouette|logo|panoramio[- ]\s*\d+|^File:Pano|topographic|street ?view|wikipedia logo|placeholder|unknown)/i;
  return rows.find(r => {
    if (!/jpeg|jpg/i.test(r.mime ?? "")) return false;
    if ((r.width ?? 0) < 1000) return false;
    if ((r.width ?? 0) < (r.height ?? 1)) return false;  // landscape only
    if (!/(CC|Public|PD|GFDL|FAL)/i.test(r.license ?? "")) return false;
    if (REJECT_TITLE.test(r.title)) return false;
    return true;
  });
}

async function main() {
  let ok = 0, fail = 0;
  for (const [idStr, category] of Object.entries(CATEGORIES)) {
    const id = Number(idStr);
    const num = String(id).padStart(3, "0");
    const outPath = path.join(OUT_DIR, `geo_${num}.jpg`);
    try {
      const titles = await categoryFiles(category);
      if (!titles.length) { console.log(`#${num} ✗ no files in Category:${category}`); fail++; await sleep(200); continue; }
      const rows = await imageInfo(titles.slice(0, 20));
      const best = pickBest(rows);
      if (!best) { console.log(`#${num} ✗ no acceptable JPEG in ${titles.length} files`); fail++; await sleep(200); continue; }
      const r = await fetch(best.thumbUrl, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error(`download ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      console.log(`#${num} ✓ ${best.title} (${(buf.length/1024).toFixed(0)} KB) — ${best.license}`);
      ok++;
    } catch (e) {
      console.log(`#${num} ✗ ${e.message}`);
      fail++;
    }
    await sleep(1500);  // be polite to Wikimedia
  }
  console.log(`\n${ok} fixed, ${fail} still failing`);
}

main().catch(e => { console.error(e); process.exit(1); });
