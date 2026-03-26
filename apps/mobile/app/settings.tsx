import React from "react";
import { useRouter } from "expo-router";
import { SettingsScreen } from "../src/screens/SettingsScreen";

export default function SettingsPage() {
  const router = useRouter();
  return <SettingsScreen onClose={() => router.back()} />;
}
