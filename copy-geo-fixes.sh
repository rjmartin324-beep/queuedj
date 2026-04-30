#!/data/data/com.termux/files/usr/bin/bash
cp -r /sdcard/box-client-dist/geo-photos/* ~/box-client/dist/geo-photos/
echo "ok" > /sdcard/copy-geo-done.txt
ls ~/box-client/dist/geo-photos/ | wc -l >> /sdcard/copy-geo-done.txt
