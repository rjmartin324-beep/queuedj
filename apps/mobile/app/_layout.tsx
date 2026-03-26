import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { RoomProvider } from "../src/contexts/RoomContext";
import { ThemeProvider } from "../src/contexts/ThemeContext";
import { OnboardingScreen, ONBOARDED_KEY } from "../src/screens/OnboardingScreen";
import { ErrorBoundary } from "../src/components/shared/ErrorBoundary";
import { AchievementToast } from "../src/components/shared/AchievementToast";
import { registerForPushNotifications, registerGlobalToken } from "../src/lib/notifications";
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
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

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

  // Null = loading, don't flash anything
  if (onboarded === null) return null;

  if (!onboarded) {
    return (
      <ThemeProvider>
        <StatusBar style="light" />
        <OnboardingScreen onComplete={() => setOnboarded(true)} />
      </ThemeProvider>
    );
  }

  return (
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
  );
}
