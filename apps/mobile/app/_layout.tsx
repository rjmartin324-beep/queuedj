import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Sentry from "@sentry/react-native";
import { RoomProvider } from "../src/contexts/RoomContext";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { OnboardingScreen, ONBOARDED_KEY } from "../src/screens/OnboardingScreen";
import { IntroVideoScreen } from "../src/screens/IntroVideoScreen";
import { ErrorBoundary } from "../src/components/shared/ErrorBoundary";
import { AchievementToast } from "../src/components/shared/AchievementToast";
import {
  registerForPushNotifications,
  registerGlobalToken,
  addNotificationResponseListener,
} from "../src/lib/notifications";
import { getIdentity } from "../src/lib/identity";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
  environment: process.env.EXPO_PUBLIC_ENV ?? "development",
  // Only send errors in production builds
  enabled: (process.env.EXPO_PUBLIC_ENV ?? "development") !== "development",
  tracesSampleRate: 0.2,
});

// ─────────────────────────────────────────────────────────────────────────────
// Root Layout — wraps the entire app in RoomProvider so every screen
// can read room state and send actions without prop drilling.
// Shows OnboardingScreen on first launch.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export default function RootLayout() {
  const router = useRouter();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((val) => {
      setOnboarded(val === "1");
    });
  }, []);

  // Register push token globally once after onboarding so daily SOTD + streak pushes work
  useEffect(() => {
    if (!onboarded) return;
    (async () => {
      const token = await registerForPushNotifications();
      if (!token) return;
      const { guestId } = await getIdentity();
      await registerGlobalToken(API_URL, guestId, token);
    })();
  }, [onboarded]);

  // ─── Notification tap handling ─────────────────────────────────────────────
  useEffect(() => {
    if (!onboarded) return;

    function handleData(data: Record<string, unknown>) {
      if (!data?.type) return;
      switch (data.type as string) {
        case "room_closing":
        case "room_invite": {
          const code = data.roomCode as string | undefined;
          if (code) {
            // Navigate home with code pre-filled and join modal auto-opened
            router.push({ pathname: "/", params: { code, openJoin: "1" } } as any);
          } else {
            router.push("/");
          }
          break;
        }
        // Engagement notifications just bring the user to the home screen
        case "song_of_the_day":
        case "streak_at_risk":
        case "guest_joined":
        case "track_requested":
        case "now_playing":
        default:
          router.push("/");
          break;
      }
    }

    // Warm start: app was in foreground or background
    const sub = addNotificationResponseListener((resp) => {
      handleData(resp.notification.request.content.data as Record<string, unknown>);
    });

    // Cold start: app was killed when notification arrived
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) handleData(resp.notification.request.content.data as Record<string, unknown>);
    });

    return () => sub.remove();
  }, [onboarded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Null = loading, don't flash anything
  if (onboarded === null) return null;

  if (!onboarded) {
    return (
      <ThemeProvider>
        <StatusBar style="light" />
        <OnboardingScreen onComplete={() => { setOnboarded(true); setShowIntro(true); }} />
      </ThemeProvider>
    );
  }

  if (showIntro) {
    return <IntroVideoScreen onFinish={() => setShowIntro(false)} />;
  }

  return (
    <SafeAreaProvider>
    <ErrorBoundary>
      <ThemeProvider>
        <RoomProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0a0a0a" },
              animation: "fade",
            }}
          />
          <AchievementToast />
        </RoomProvider>
      </ThemeProvider>
    </ErrorBoundary>
    </SafeAreaProvider>
  );
}
