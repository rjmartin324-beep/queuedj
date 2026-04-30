#!/data/data/com.termux/files/usr/bin/bash
set -e
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 1
cp ~/storage/shared/phase2/index.ts ~/partyglue/src/index.ts
cp ~/storage/shared/box-client-dist/index.html               ~/box-client/dist/
cp ~/storage/shared/box-client-dist/manifest.webmanifest     ~/box-client/dist/
cp ~/storage/shared/box-client-dist/registerSW.js            ~/box-client/dist/
cp ~/storage/shared/box-client-dist/sw.js                    ~/box-client/dist/
cp ~/storage/shared/box-client-dist/workbox-*.js             ~/box-client/dist/
cp ~/storage/shared/box-client-dist/assets/*                 ~/box-client/dist/assets/
echo "Updated — starting server"
cd ~/partyglue
node --max-old-space-size=256 node_modules/.bin/tsx src/index.ts > /sdcard/server.log 2>&1 &
sleep 3
cat /sdcard/server.log
