// ─────────────────────────────────────────────────────────────────────────────
// Push Notification Sender
//
// Sends push notifications via Expo Push API.
// Expo handles FCM (Android) + APNs (iOS) routing automatically.
// FCM_SERVER_KEY is only needed if bypassing Expo and hitting FCM directly.
//
// Uses Expo Push API — no separate FCM/APNs SDK needed on server.
// ─────────────────────────────────────────────────────────────────────────────

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

export interface PushMessage {
  to: string | string[]          // Expo push token(s)
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: "default" | null
  badge?: number
  channelId?: string             // Android channel
}

export async function sendPushNotification(message: PushMessage): Promise<void> {
  const tokens = Array.isArray(message.to) ? message.to : [message.to]
  if (tokens.length === 0) return

  // Expo push API accepts up to 100 messages per request
  const chunks = chunkArray(tokens, 100)

  await Promise.allSettled(
    chunks.map((chunk) =>
      fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(
          chunk.map((token) => ({
            to: token,
            title: message.title,
            body: message.body,
            data: message.data ?? {},
            sound: message.sound ?? "default",
            badge: message.badge,
            channelId: message.channelId ?? "default",
          })),
        ),
      }).then((res) => {
        if (!res.ok) {
          console.warn("[push] Expo push API error:", res.status)
        }
      }),
    ),
  )
}

// ─── Convenience senders ──────────────────────────────────────────────────────

export function notifyGuestJoined(
  hostToken: string,
  guestName: string,
  roomCode: string,
) {
  return sendPushNotification({
    to: hostToken,
    title: "New guest joined",
    body: `${guestName} joined ${roomCode}`,
    data: { type: "guest_joined", roomCode },
    sound: "default",
  })
}

export function notifyTrackRequested(
  hostToken: string,
  trackTitle: string,
  artist: string,
  guestName: string,
) {
  return sendPushNotification({
    to: hostToken,
    title: "Track requested",
    body: `${guestName} wants "${trackTitle}" by ${artist}`,
    data: { type: "track_requested" },
    sound: "default",
  })
}

export function notifyNowPlaying(
  guestTokens: string[],
  trackTitle: string,
  artist: string,
) {
  return sendPushNotification({
    to: guestTokens,
    title: "Now playing",
    body: `${trackTitle} — ${artist}`,
    data: { type: "now_playing" },
    sound: null,   // Silent — don't interrupt the music
  })
}

export function notifyRoomClosingSoon(
  guestTokens: string[],
  roomCode: string,
  minutesLeft: number,
) {
  return sendPushNotification({
    to: guestTokens,
    title: "Room closing soon",
    body: `Room ${roomCode} ends in ${minutesLeft} minutes`,
    data: { type: "room_closing", roomCode, minutesLeft },
    sound: "default",
  })
}

export function sendSOTDPush(
  tokens: string[],
  sotd: { title: string; artist: string; genre?: string; curatedNote?: string },
) {
  if (tokens.length === 0) return Promise.resolve()
  const body = sotd.curatedNote
    ? sotd.curatedNote
    : `${sotd.title} — ${sotd.artist}${sotd.genre ? ` · ${sotd.genre}` : ""}`
  return sendPushNotification({
    to: tokens,
    title: "🎵 Song of the Day",
    body,
    data: { type: "song_of_the_day", title: sotd.title, artist: sotd.artist },
    sound: "default",
    channelId: "sotd",
  })
}

export function sendStreakAtRiskPush(tokens: string[]) {
  if (tokens.length === 0) return Promise.resolve()
  return sendPushNotification({
    to: tokens,
    title: "🔥 Don't break your streak!",
    body: "You partied last night — keep it going and join a room tonight.",
    data: { type: "streak_at_risk" },
    sound: "default",
    channelId: "streaks",
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
