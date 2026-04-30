#!/data/data/com.termux/files/usr/bin/bash
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 1
cd ~/partyglue
nohup node --max-old-space-size=256 node_modules/.bin/tsx src/index.ts > /sdcard/server.log 2>&1 &
disown
echo "started" > /sdcard/start-done.txt
sleep 4
head -30 /sdcard/server.log >> /sdcard/start-done.txt
