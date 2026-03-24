import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { RoomProvider } from "../src/contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Root Layout — wraps the entire app in RoomProvider so every screen
// can read room state and send actions without prop drilling.
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <RoomProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0a" },
          animation: "fade",
        }}
      />
    </RoomProvider>
  );
}
