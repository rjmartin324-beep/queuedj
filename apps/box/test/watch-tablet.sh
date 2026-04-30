#!/usr/bin/env bash
# watch-tablet.sh — Per-minute telemetry for a soak run on the Fire HD8.
# Polls memory, log size, DB row counts, battery; emits a CSV row per sample.
#
# Run alongside the soak orchestrator:
#   bash apps/box/test/watch-tablet.sh > soak-$(date +%Y-%m-%d-%H%M).csv
#   (Ctrl-C to stop)
#
# Columns: ts_iso, elapsed_s, mem_total_kb, log_lines, db_rooms, db_sessions, db_scores, battery_pct
#
# Tunables via env: ADB= path, INTERVAL_S=60, BATTERY_INTERVAL_S=300, DB_INTERVAL_S=600

ADB="${ADB:-/c/Users/rjmar/AppData/Local/Android/Sdk/platform-tools/adb.exe}"
INTERVAL_S="${INTERVAL_S:-60}"
BATTERY_INTERVAL_S="${BATTERY_INTERVAL_S:-300}"
DB_INTERVAL_S="${DB_INTERVAL_S:-600}"
DB_PATH="${DB_PATH:-/data/data/com.termux/files/home/partyglue/partyglue.db}"

start_ts=$(date +%s)
last_battery_t=0
last_db_t=0
cached_battery=""
cached_rooms=""
cached_sessions=""
cached_scores=""

# CSV header
echo "ts_iso,elapsed_s,mem_total_kb,log_lines,db_rooms,db_sessions,db_scores,battery_pct"

# Stderr banner so user knows it's alive
>&2 echo "[watch-tablet] target adb=$ADB  interval=${INTERVAL_S}s  ctrl-c to stop"

trap 'echo "[watch-tablet] stopped" >&2; exit 0' INT TERM

while true; do
  now=$(date +%s)
  iso=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  elapsed=$(( now - start_ts ))

  # Memory: dumpsys meminfo gives a TOTAL line in KB
  mem_kb=$("$ADB" shell "dumpsys meminfo com.termux 2>/dev/null | awk '/TOTAL/ && NF>1 {print \$2; exit}'" 2>/dev/null | tr -d '\r ')
  mem_kb=${mem_kb:-NA}

  # Log lines (cheap)
  log_lines=$("$ADB" shell "wc -l /sdcard/server.log 2>/dev/null | awk '{print \$1}'" 2>/dev/null | tr -d '\r ')
  log_lines=${log_lines:-NA}

  # Battery — every BATTERY_INTERVAL_S
  if (( now - last_battery_t >= BATTERY_INTERVAL_S )); then
    cached_battery=$("$ADB" shell "dumpsys battery 2>/dev/null | awk '/level/ {print \$2; exit}'" 2>/dev/null | tr -d '\r ')
    cached_battery=${cached_battery:-NA}
    last_battery_t=$now
  fi

  # DB row counts — every DB_INTERVAL_S, requires sqlite3 in Termux
  if (( now - last_db_t >= DB_INTERVAL_S )); then
    db_csv=$("$ADB" shell "sqlite3 $DB_PATH 'SELECT COUNT(*) FROM rooms; SELECT COUNT(*) FROM game_sessions; SELECT COUNT(*) FROM scores;' 2>/dev/null" 2>/dev/null | tr -d '\r' | paste -sd, -)
    if [ -n "$db_csv" ]; then
      IFS=',' read -r cached_rooms cached_sessions cached_scores <<<"$db_csv"
    fi
    cached_rooms=${cached_rooms:-NA}
    cached_sessions=${cached_sessions:-NA}
    cached_scores=${cached_scores:-NA}
    last_db_t=$now
  fi

  echo "$iso,$elapsed,$mem_kb,$log_lines,$cached_rooms,$cached_sessions,$cached_scores,$cached_battery"

  sleep "$INTERVAL_S"
done
