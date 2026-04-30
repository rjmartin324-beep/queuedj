#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "=== PartyGlue Box Deploy ==="

# Stop running server
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 1
echo "[1/8] Server stopped"

# Make sure dirs exist
mkdir -p ~/partyglue/src/games
mkdir -p ~/partyglue/src/seed
mkdir -p ~/box-client/dist
echo "[2/8] Dirs ensured"

# Source: ts files
cp /sdcard/box/src/index.ts          ~/partyglue/src/index.ts
cp /sdcard/box/src/db.ts             ~/partyglue/src/db.ts
cp /sdcard/box/src/types.ts          ~/partyglue/src/types.ts
cp /sdcard/box/src/rooms.ts          ~/partyglue/src/rooms.ts
cp /sdcard/box/src/seed-trivia.ts    ~/partyglue/src/seed-trivia.ts
cp /sdcard/box/src/seed-wyr.ts       ~/partyglue/src/seed-wyr.ts
cp /sdcard/box/src/sqlite.d.ts       ~/partyglue/src/sqlite.d.ts 2>/dev/null || true
cp /sdcard/box/package.json          ~/partyglue/package.json
cp /sdcard/box/tsconfig.json         ~/partyglue/tsconfig.json
cp /sdcard/box/tsconfig.base.json    ~/partyglue/tsconfig.base.json 2>/dev/null || true
echo "[3/8] Server core copied"

# All 9 game modules
cp /sdcard/box/src/games/*.ts        ~/partyglue/src/games/
echo "[4/8] All 9 game modules copied"

# All seed JSONs (Trivia, WYR, plus the 7 new games)
cp /sdcard/box/src/seed/*.json       ~/partyglue/src/seed/
echo "[5/8] Seed JSONs copied"

# Client dist
cp -r /sdcard/box-client-dist/.      ~/box-client/dist/
echo "[6/8] Client dist copied"

# Delete old DB and reseed BOTH trivia + WYR
cd ~/partyglue
rm -f partyglue.db
node --max-old-space-size=256 node_modules/.bin/tsx src/seed-trivia.ts
node --max-old-space-size=256 node_modules/.bin/tsx src/seed-wyr.ts
echo "[7/8] DB reseeded"

# Verify counts
node --max-old-space-size=256 -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('partyglue.db');
const t = db.prepare('SELECT COUNT(*) as n FROM trivia_questions').get().n;
const w = db.prepare('SELECT COUNT(*) as n FROM wyr_prompts').get().n;
console.log('  Trivia questions:', t);
console.log('  WYR prompts:    ', w);
"
echo "[8/8] Verified"

echo ""
echo "=== Deploy complete ==="
echo ""
echo "To start the server:"
echo "  cd ~/partyglue && node --max-old-space-size=256 node_modules/.bin/tsx src/index.ts"
