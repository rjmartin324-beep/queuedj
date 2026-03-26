import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { Platform } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"

// ─────────────────────────────────────────────────────────────────────────────
// Push Notification Registration
//
// Registers for Expo push notifications, stores the token in AsyncStorage,
// and registers it with the server so the host can receive room events.
//
// Notification types we send:
//   - Guest joined   (host only)
//   - Track requested (host only)
//   - Now playing changed (all guests)
//   - Room closing soon (all guests)
// ─────────────────────────────────────────────────────────────────────────────

const PUSH_TOKEN_KEY = "push_token"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[notifications] Push notifications require a physical device")
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== "granted") {
    console.warn("[notifications] Push notification permission denied")
    return null
  }

  if (Platform.OS === "android") {
    await Promise.all([
      Notifications.setNotificationChannelAsync("default", {
        name: "PartyGlue",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#6C63FF",
      }),
      Notifications.setNotificationChannelAsync("sotd", {
        name: "Song of the Day",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
        lightColor: "#6C63FF",
      }),
      Notifications.setNotificationChannelAsync("streaks", {
        name: "Streak Reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: "default",
        lightColor: "#FF6B35",
      }),
    ])
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
  return token
}

export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY)
}

export async function registerTokenWithServer(
  apiUrl: string,
  roomId: string,
  pushToken: string,
  role: "host" | "guest",
): Promise<void> {
  try {
    await fetch(`${apiUrl}/notifications/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, pushToken, role }),
    })
  } catch (err) {
    // Non-critical — notifications are best-effort
    console.warn("[notifications] Failed to register token:", err)
  }
}

/**
 * Register push token in the global registry so the guest receives
 * daily SOTD and streak-at-risk notifications even when not in a room.
 * Fire-and-forget — never throws.
 */
export async function registerGlobalToken(
  apiUrl: string,
  guestId: string,
  pushToken: string,
): Promise<void> {
  try {
    await fetch(`${apiUrl}/notifications/register-global`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId, pushToken }),
    })
  } catch {
    // Non-critical
  }
}

export async function unregisterTokenFromServer(
  apiUrl: string,
  roomId: string,
  pushToken: string,
): Promise<void> {
  try {
    await fetch(`${apiUrl}/notifications/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, pushToken }),
    })
  } catch {
    // Non-critical
  }
}

// ─── Local Notification Helpers ───────────────────────────────────────────────

const NOTIF_PREF_KEY = "queuedj_notifications_enabled";

async function notificationsEnabled(): Promise<boolean> {
  const AsyncStorageModule = (await import("@react-native-async-storage/async-storage")).default;
  const val = await AsyncStorageModule.getItem(NOTIF_PREF_KEY);
  return val !== "0";
}

export async function localNotifyCreditsEarned(amount: number, reason: string): Promise<void> {
  if (!await notificationsEnabled()) return;
  const labels: Record<string, string> = {
    vote_cast:     "Vote registered",
    track_request: "Track added to queue",
    game_win:      "You won a game round!",
    full_session:  "Session complete",
  };
  await Notifications.scheduleNotificationAsync({
    content: { title: `⚡ +${amount} Vibe Credits`, body: labels[reason] ?? reason },
    trigger: null,
  }).catch(() => {});
}

export async function localNotifyTrackUpNext(title: string, artist: string): Promise<void> {
  if (!await notificationsEnabled()) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "🎵 Your track is up next!", body: `${title} — ${artist}` },
    trigger: null,
  }).catch(() => {});
}

export async function localNotifyGameStarting(gameName: string): Promise<void> {
  if (!await notificationsEnabled()) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: "🎮 Game time!", body: `${gameName} is starting — jump in!` },
    trigger: null,
  }).catch(() => {});
}

// ─── Notification listener hooks (call once at app root) ──────────────────────

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(handler)
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler)
}
