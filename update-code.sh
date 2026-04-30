#!/data/data/com.termux/files/usr/bin/bash
set -e
echo "[update-code] stopping server"
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 1

echo "[update-code] copying server src"
cp /sdcard/box/src/*.ts            ~/partyglue/src/                     2>/dev/null || true
cp /sdcard/box/src/games/*.ts      ~/partyglue/src/games/               2>/dev/null || true
cp /sdcard/box/src/seed/*.json     ~/partyglue/src/seed/                2>/dev/null || true
cp /sdcard/box/package.json        ~/partyglue/package.json             2>/dev/null || true
cp /sdcard/box/tsconfig.json       ~/partyglue/tsconfig.json            2>/dev/null || true
cp /sdcard/box/tsconfig.base.json  ~/partyglue/tsconfig.base.json       2>/dev/null || true

echo "[update-code] copying client dist"
cp -r /sdcard/box-client-dist/.    ~/box-client/dist/                   2>/dev/null || true

echo "[update-code] starting server"
cd ~/partyglue
nohup node --max-old-space-size=256 node_modules/.bin/tsx src/index.ts > /sdcard/server.log 2>&1 &
disown
echo "started" > /sdcard/update-done.txt
sleep 4
tail -20 /sdcard/server.log >> /sdcard/update-done.txt
