/**
 * Haptics — thin wrapper around expo-haptics.
 * All calls are fire-and-forget and never throw (web/simulator safe).
 */

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

const isNative = Platform.OS !== "web";

/** Light tap — nav, button press, minor confirmation */
export function tapLight() {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium tap — vote, queue reorder */
export function tapMedium() {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Heavy thud — game win, major reveal */
export function tapHeavy() {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Success notification — track request accepted */
export function notifySuccess() {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning notification — vibe guardrail soft warn */
export function notifyWarning() {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Error notification — track request rejected, insufficient credits */
export function notifyError() {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** Selection tick — picker scroll, toggle */
export function selectionTick() {
  if (!isNative) return;
  Haptics.selectionAsync().catch(() => {});
}
