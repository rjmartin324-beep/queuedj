# GeoGuesser Photo Collection Strategy
**Project:** PartyGlue Box — Offline GeoGuesser  
**Target:** 375 photos across 3 difficulty tiers, all world regions  
**Date:** 2026-04-28

---

## Best Source: Wikimedia Commons

**Winner, and it's not close.** Here's why:

| Source | Geotagged? | Bulk API? | License Clarity | Obscure Locations | Verdict |
|---|---|---|---|---|---|
| Wikimedia Commons | Yes — precise lat/lng on many files | Yes — free, documented | CC BY-SA / CC0 / PD | Excellent — has Oymyakon, Darvaza, Socotra | **Use this** |
| Unsplash | Rarely — text location only | Yes (API key required) | Free but non-Commercial? (check ToS) | Poor — biased toward photogenic travel hotspots | Supplement for Easy tier |
| Pexels | Rarely | Yes (API key) | Pexels license (not CC, no redistribution in competing product) | Poor | Avoid for offline bundling |
| Pixabay | Occasionally | Yes (API key) | CC0 for most | Moderate | Backup only |
| OpenStreetMap photo layer | Links to Wikimedia | N/A (it's a link layer) | Inherited from Wikimedia | Excellent | It IS Wikimedia |

**Wikimedia wins on every axis that matters for offline bundling:** free API, CC/PD licenses you can legally bundle with the app, geotagged metadata baked into the files, and deep coverage of obscure/hard locations that other stock sites don't touch.

**Licensing gotcha for Wikimedia CC BY-SA:** The photo license requires attribution. For a local party game that never distributes the photos commercially, this is low risk, but technically you should include an attribution file. Best practice: ship a `PHOTO_CREDITS.txt` alongside the app listing filename → original Commons URL → author → license. This is one afternoon of work once you have the final 375.

---

## How to Bulk Collect the Remaining 315 Locations

### Phase 1: Geosearch API (best for Hard tier)
Use the Wikimedia Commons `geosearch` API to find geotagged photos near any lat/lng:

```
https://commons.wikimedia.org/w/api.php
  ?action=query
  &list=geosearch
  &gscoord=LAT|LNG
  &gsradius=50000       ← 50km radius
  &gslimit=20
  &gsnamespace=6        ← File namespace only
  &format=json
```

This returns file names. Then fetch image info (direct URL + dimensions):

```
https://commons.wikimedia.org/w/api.php
  ?action=query
  &titles=File:FILENAME
  &prop=imageinfo
  &iiprop=url|size|mime|extmetadata
  &iiurlwidth=1200      ← request resized version at 1200px
  &format=json
```

The `extmetadata` field includes GPS coordinates, license, author, and description — everything you need for the manifest, pulled automatically.

### Phase 2: Category Search (best for Easy/Medium tier)
Wikimedia has rich categories like:
- `Category:Landmarks_in_France`
- `Category:Photographs_of_Tokyo`
- `Category:Coastlines_of_Norway`
- `Category:Rural_scenes_in_Bolivia`

API:
```
https://commons.wikimedia.org/w/api.php
  ?action=query
  &list=categorymembers
  &cmtitle=Category:Landmarks_in_France
  &cmtype=file
  &cmlimit=50
  &format=json
```

Then filter to images ≥ 800px wide with `imageinfo`.

### Phase 3: Automation Script
Write a Node.js or Python script with this logic:
1. Load `geo-manifest.json`
2. For each entry with no `file` downloaded yet, call geosearch API at that lat/lng
3. Filter results: JPEG only, width ≥ 800, height < width (landscape), license is CC/PD
4. Pick the highest-resolution match
5. Download resized version (iiurlwidth=1200) to `src/geo-photos/`
6. Write downloaded filename back to manifest

A single script run can populate 30-50 photos in a few minutes. Rate limit: Wikimedia asks for ≤ 200 requests/minute with a User-Agent header identifying your app.

---

## Coverage Plan for Full 375

### Easy (125 total — 20 in manifest, need 105 more)
Draw from:
- All remaining UNESCO World Heritage Sites with famous visuals (~40)
- Major world capital skylines (~25)
- Iconic natural wonders: Grand Canyon, Niagara Falls, Victoria Falls, Northern Lights, etc. (~40)

### Medium (125 total — 20 in manifest, need 105 more)
Draw from:
- Regional capitals in each world region (~40)
- Coastal geography: fjords, deltas, archipelagos (~25)
- Cultural street scenes: souks, temples, markets, train stations (~40)

### Hard (125 total — 20 in manifest, need 105 more)
This is the hardest to fill, and the most important for game balance. Strategy:
- Use geosearch at random points in Central Africa, Central Asia, rural South America, Pacific island nations
- Target countries that rarely appear in stock photo sites: Burundi, Turkmenistan, Marshall Islands, Suriname, Bhutan, Comoros
- Use Wikipedia "Geography of X" article photo links as seed URLs
- Prioritize landscape diversity: don't duplicate biomes (no need for 10 different savanna shots)

---

## Region Balance Target

| Region | Easy | Medium | Hard | Total |
|---|---|---|---|---|
| Europe | 20 | 22 | 18 | 60 |
| North America | 18 | 18 | 14 | 50 |
| Asia | 22 | 22 | 21 | 65 |
| South America | 10 | 12 | 13 | 35 |
| Africa | 10 | 12 | 13 | 35 |
| Middle East | 10 | 10 | 10 | 30 |
| Oceania | 10 | 10 | 10 | 30 |
| Polar/Remote | 5 | 9 | 16 | 30 |
| **Total** | **105** | **115** | **115** | **335** |

Note: These are targets. Add ~40 flex slots to hit 375, filling coverage gaps after first pass.

---

## File Size Budget

**Target per photo:** 150–350 KB (JPEG at 1200px wide, quality 75–85)  
**375 photos × 300 KB avg = ~112 MB**

Fire HD8 has 16–32 GB storage and the app is sideloaded, so this is comfortable. Don't go over 500 KB per photo — there's no reason to, since you're displaying at ~1024px max on the tablet screen.

If Wikimedia's resized downloads come in too large, run them through `sharp` (Node) or `imagemin` in the build pipeline to normalize.

---

## Immediate Next Steps

1. **Grant shell/WebFetch permissions** in this Claude Code session so the download script can run.
2. Create `src/geo-photos/` folder.
3. Write the Node.js bulk-download script (`src/seed/download-photos.js`) using the Wikimedia API approach above.
4. Run it on the first 60 manifest entries to download 60 real photos.
5. Spot-check: verify each photo is actually at the right location, landscape orientation, no watermarks.
6. Expand manifest to 375 entries using the region/difficulty targets above.
7. Run download script on full manifest.
8. Build `PHOTO_CREDITS.txt` from the `extmetadata` API responses (author + license + source URL).

---

## Gotchas

- **CC BY-SA viral concern:** CC BY-SA doesn't require your app's *code* to be SA, only any *derivative* of the photo. Displaying an unmodified photo in a game does not create a derivative. You're fine.
- **Wikimedia mirrors:** Some `commons.wikimedia.org` image URLs redirect to `upload.wikimedia.org` — this is expected. The final URL is what to store for attribution purposes.
- **Portrait photos:** Wikimedia has many portrait-oriented landmark shots. Filter with `width > height` in the API response before downloading.
- **Photo freshness:** Some Wikimedia photos are old (pre-2010). For landmarks this is fine. For urban street scenes, an old photo might show a now-demolished building — acceptable for a party game.
- **Duplicate subjects:** Running geosearch at a famous location will return dozens of Eiffel Tower shots. Pick one and move on. Keep a set of already-used locations in your script to avoid duplicates.
- **Socotra / Yemen:** The Dragon Blood Trees photo is on Wikimedia Commons under CC BY-SA. It exists. Just search `Dracaena cinnabari Socotra`.
