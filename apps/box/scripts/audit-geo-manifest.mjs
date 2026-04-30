#!/usr/bin/env node
// Audits apps/box/src/seed/geo-manifest.json by reverse-geocoding each
// entry's (lat, lng) via OSM Nominatim and comparing the resolved country
// against the manifest's `country` field. Flags mismatches to stdout.
//
// Usage: node scripts/audit-geo-manifest.mjs
// Respects Nominatim's 1 req/sec rate limit. ~2 min for 120 entries.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "..", "src", "seed", "geo-manifest.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Country-name normalization so "United States" / "USA" / "United States of America"
// all match. Maps Nominatim's English name → list of alternative spellings the
// manifest might use.
const aliases = {
  "United States":             ["USA", "United States of America", "US"],
  "United Kingdom":            ["UK", "Great Britain", "Britain", "England"],
  "Russia":                    ["Russian Federation"],
  "Czechia":                   ["Czech Republic"],
  "South Korea":               ["Republic of Korea", "Korea, South"],
  "North Korea":               ["DPRK", "Korea, North"],
  "Vatican City":              ["Vatican", "Holy See"],
  "Myanmar":                   ["Burma"],
  "Côte d'Ivoire":             ["Ivory Coast"],
  "Bosnia and Herzegovina":    ["Bosnia"],
  "Macedonia":                 ["North Macedonia"],
  "Türkiye":                   ["Turkey"],
};
function countryMatches(resolved, claimed) {
  if (!resolved || !claimed) return false;
  if (resolved.toLowerCase() === claimed.toLowerCase()) return true;
  for (const [canon, alts] of Object.entries(aliases)) {
    const all = [canon, ...alts].map(s => s.toLowerCase());
    if (all.includes(resolved.toLowerCase()) && all.includes(claimed.toLowerCase())) return true;
  }
  return false;
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=5&accept-language=en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "PartyGlue-Box/1.0 (geo-manifest audit)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return j.address?.country ?? null;
}

const flagged = [];
const errors = [];
console.log(`Auditing ${data.length} entries against Nominatim...`);
for (let i = 0; i < data.length; i++) {
  const entry = data[i];
  try {
    const resolved = await reverseGeocode(entry.lat, entry.lng);
    const ok = countryMatches(resolved, entry.country);
    if (!ok) {
      flagged.push({ id: entry.id, file: entry.file, location: entry.location,
        claimedCountry: entry.country, resolvedCountry: resolved,
        lat: entry.lat, lng: entry.lng });
      console.log(`  [MISMATCH] #${entry.id} ${entry.location}: claimed=${entry.country}  resolved=${resolved}`);
    } else if (i % 10 === 0) {
      console.log(`  [ok] ${i+1}/${data.length} #${entry.id} ${entry.location} → ${resolved}`);
    }
  } catch (e) {
    errors.push({ id: entry.id, error: String(e.message ?? e) });
    console.log(`  [ERROR] #${entry.id} ${entry.location}: ${e.message}`);
  }
  await sleep(1100); // Nominatim rate limit: 1 req/sec, padded.
}

console.log(`\n=== Summary ===`);
console.log(`Total: ${data.length}`);
console.log(`Mismatches: ${flagged.length}`);
console.log(`Errors: ${errors.length}`);
if (flagged.length) {
  console.log(`\nFlagged rows (copy into a fix list):`);
  console.log(JSON.stringify(flagged, null, 2));
}
if (errors.length) {
  console.log(`\nErrors:`);
  console.log(JSON.stringify(errors, null, 2));
}
const outPath = path.resolve(__dirname, "..", "..", "..", "tmp-soak", "geo-audit-results.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ flagged, errors, total: data.length }, null, 2));
console.log(`\nWrote results to ${outPath}`);
