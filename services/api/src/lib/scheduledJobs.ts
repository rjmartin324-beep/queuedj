// ─────────────────────────────────────────────────────────────────────────────
// Scheduled Daily Jobs
//
// Uses a pure setTimeout approach — no external cron library needed.
// Two jobs run every 24 hours:
//
//   09:00  Song of the Day  — push to all globally registered guests
//   20:00  Streak at-risk   — push to guests active yesterday but not today
//
// Guest activity is written to Redis by the realtime service on room:join:
//   SADD guest:active:{YYYY-MM-DD} {guestId}   (expires after 49h)
// ─────────────────────────────────────────────────────────────────────────────

import { redisClient } from "../redis"
import { db } from "../db/client"
import { sendSOTDPush, sendStreakAtRiskPush } from "./push"
import { getAllGlobalTokens, getGlobalToken } from "../routes/notifications"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" for a date (defaults to today). */
function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Returns "YYYY-MM-DD" for yesterday. */
function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return isoDate(d)
}

/** Arms a daily timer. Fires at the next occurrence of hour:minute, then re-arms. */
function scheduleDaily(hour: number, minute: number, label: string, fn: () => Promise<void>) {
  function arm() {
    const now  = new Date()
    const next = new Date()
    next.setHours(hour, minute, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    const msUntil = next.getTime() - now.getTime()
    const hUntil  = (msUntil / 3_600_000).toFixed(1)
    console.log(`[scheduler] ${label} fires in ${hUntil}h`)
    setTimeout(async () => {
      console.log(`[scheduler] ${label} firing`)
      try {
        await fn()
      } catch (err) {
        console.error(`[scheduler] ${label} error`, err)
      }
      arm()  // re-arm for the next day
    }, msUntil)
  }
  arm()
}

// ─── Job: Song of the Day (09:00) ────────────────────────────────────────────

async function jobSOTD() {
  if (process.env.SOTD_ENABLED !== "true") {
    console.log("[scheduler] SOTD: disabled (set SOTD_ENABLED=true to enable)")
    return
  }
  const key  = `sotd:${isoDate()}`
  const raw  = await redisClient.get(key)

  // Seed tracks — same pool as GET /sotd so the push matches what the card shows
  const SEED_TRACKS = [
    { title: "Blinding Lights",             artist: "The Weeknd",                      genre: "Synth-pop",  curatedNote: "The ultimate midnight drive anthem." },
    { title: "Uptown Funk",                 artist: "Mark Ronson ft. Bruno Mars",      genre: "Funk",       curatedNote: "Zero percent chance this doesn't make you move." },
    { title: "Happy",                       artist: "Pharrell Williams",               genre: "Neo-soul",   curatedNote: "The literal definition of good vibes." },
    { title: "Shape of You",               artist: "Ed Sheeran",                      genre: "Pop",        curatedNote: "Still a banger. Don't @ us." },
    { title: "Starboy",                     artist: "The Weeknd ft. Daft Punk",        genre: "Synthwave",  curatedNote: "Daft Punk on a Weeknd track. Need we say more?" },
    { title: "Mr. Brightside",             artist: "The Killers",                     genre: "Indie Rock", curatedNote: "The crowd knows every word. Every single time." },
    { title: "Somebody That I Used To Know", artist: "Gotye ft. Kimbra",              genre: "Indie Pop",  curatedNote: "Haunting, beautiful, and still bittersweet." },
  ]

  let sotd: { title: string; artist: string; genre?: string; curatedNote?: string }
  if (raw) {
    try {
      sotd = JSON.parse(raw)
    } catch {
      console.warn("[scheduler] SOTD: invalid JSON, falling back to seed track")
      const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
      sotd = SEED_TRACKS[doy % SEED_TRACKS.length]
      // Overwrite the corrupt key with the seed track
      await redisClient.set(key, JSON.stringify(sotd), { EX: 90_000 })
    }
  } else {
    console.log("[scheduler] SOTD: no Redis entry for today, using seed track")
    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
    sotd = SEED_TRACKS[doy % SEED_TRACKS.length]
    // Persist so the GET /sotd route returns the same track and future reads don't re-derive
    await redisClient.set(key, JSON.stringify(sotd), { EX: 90_000 })
  }

  const tokens = await getAllGlobalTokens()
  if (tokens.length === 0) {
    console.log("[scheduler] SOTD: no registered tokens, skipping")
    return
  }

  await sendSOTDPush(tokens, sotd)
  console.log(`[scheduler] SOTD: sent to ${tokens.length} token(s) — "${sotd.title}"`)
}

// ─── Job: Streak at-risk reminder (20:00) ────────────────────────────────────

async function jobStreakReminder() {
  const todayKey     = `guest:active:${isoDate()}`
  const yesterdayKey = `guest:active:${yesterday()}`

  const [activeToday, activeYesterday] = await Promise.all([
    redisClient.sMembers(todayKey),
    redisClient.sMembers(yesterdayKey),
  ])

  const todaySet   = new Set(activeToday)
  const atRisk     = activeYesterday.filter((id) => !todaySet.has(id))

  if (atRisk.length === 0) {
    console.log("[scheduler] streak: no at-risk guests today")
    return
  }

  // Resolve push tokens for at-risk guests — skip those with no global token
  const tokenEntries = await Promise.all(
    atRisk.map(async (guestId) => {
      const token = await getGlobalToken(guestId)
      return token
    }),
  )
  const tokens = tokenEntries.filter((t): t is string => !!t)

  if (tokens.length === 0) {
    console.log("[scheduler] streak: at-risk guests found but none have push tokens")
    return
  }

  await sendStreakAtRiskPush(tokens)
  console.log(`[scheduler] streak: sent reminder to ${tokens.length} at-risk guest(s)`)
}

// ─── Job: Data retention cleanup (03:00) ────────────────────────────────────

async function jobDataRetention() {
  try {
    const result = await db.query<{ cleanup_expired_data: number }>(
      "SELECT cleanup_expired_data()"
    )
    const deleted = result.rows[0]?.cleanup_expired_data ?? 0
    console.log(`[scheduler] data-retention: deleted ${deleted} expired row(s)`)
  } catch (err) {
    console.error("[scheduler] data-retention: error", err)
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function startScheduledJobs() {
  scheduleDaily(3,  0,  "data-retention cleanup", jobDataRetention)
  scheduleDaily(9,  0,  "SOTD push",              jobSOTD)
  scheduleDaily(20, 0,  "streak-at-risk push",     jobStreakReminder)
}
