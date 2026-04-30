#!/data/data/com.termux/files/usr/bin/bash
rm -f /sdcard/deploy-done.txt
bash /sdcard/deploy-phase3.sh > /sdcard/deploy.log 2>&1
echo "$?" > /sdcard/deploy-done.txt
