import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, AppState } from "react-native";
import {
  getValidGuestToken,
  generateCodeVerifier,
  getGuestAuthUrl,
  exchangeGuestCode,
  clearGuestTokens,
} from "../../lib/spotifyGuest";

// ─────────────────────────────────────────────────────────────────────────────
// SpotifyConnectButton
//
// Reusable Spotify OAuth PKCE connect button.
// Shows "Connect Spotify" when not authenticated, "✓ Spotify" when connected.
// Uses the guest OAuth flow (separate keys from host tokens).
//
// Deep-link handling covers two paths:
//   A) Linking "url" event — fires when app is already open in background
//   B) Linking.getInitialURL() — fires when the deep link cold-starts / resumes
//      the app (common on Android)
// AppState listener resets "connecting" if the user returns without completing
// the OAuth flow (e.g. closed the browser).
// ─────────────────────────────────────────────────────────────────────────────

let _pendingVerifier: string | null = null;

/** Safely parse query params from a URL with any scheme (queuedj://, https://, etc.) */
function parseQueryParam(url: string, key: string): string | null {
  const idx = url.indexOf("?");
  if (idx === -1) return null;
  const qs = url.slice(idx + 1);
  for (const part of qs.split("&")) {
    const [k, v] = part.split("=");
    if (decodeURIComponent(k) === key) return v ? decodeURIComponent(v) : "";
  }
  return null;
}

export function SpotifyConnectButton({ compact = false }: { compact?: boolean }) {
  const [connected,  setConnected]  = useState<boolean | null>(null); // null = initial load
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // ── On mount: check stored token + catch deep link if app was cold-started ──
  useEffect(() => {
    checkConnection();

    Linking.getInitialURL().then(url => {
      if (url) processCallback(url);
    }).catch(() => {});
  }, []);

  // ── Linking event: app was already running in background ──────────────────
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => processCallback(url));
    return () => sub.remove();
  }, []);

  // ── AppState: reset "connecting" if user returns from browser empty-handed ─
  useEffect(() => {
    const sub = AppState.addEventListener("change", nextState => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      // App came back to foreground after going to background (the browser)
      if (prev === "background" && nextState === "active") {
        // Give the Linking event 800ms to fire; if it hasn't, the user likely
        // cancelled or the redirect failed — unlock the button
        setTimeout(() => {
          setConnecting(c => {
            if (c) {
              // Still connecting after returning — check if token was actually saved
              checkConnection();
              return false;
            }
            return c;
          });
        }, 800);
      }
    });
    return () => sub.remove();
  }, []);

  async function checkConnection() {
    const token = await getValidGuestToken();
    setConnected(!!token);
  }

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const verifier = generateCodeVerifier();
      _pendingVerifier = verifier;
      const authUrl = await getGuestAuthUrl(verifier);
      await Linking.openURL(authUrl);
      // Note: stays in "connecting" state until processCallback fires or
      // AppState listener resets it
    } catch {
      setError("Could not open Spotify");
      _pendingVerifier = null;
      setConnecting(false);
    }
  }

  async function processCallback(url: string) {
    if (!url.includes("auth/spotify/callback")) return;
    if (!_pendingVerifier) return;

    const code  = parseQueryParam(url, "code");
    const error = parseQueryParam(url, "error");

    if (error || !code) {
      setError(error === "access_denied" ? "Spotify access denied" : "Auth cancelled");
      setConnecting(false);
      _pendingVerifier = null;
      return;
    }

    try {
      await exchangeGuestCode(code, _pendingVerifier);
      _pendingVerifier = null;
      setConnected(true);
      setError(null);
    } catch {
      setError("Connection failed — check network");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await clearGuestTokens();
    setConnected(false);
    setError(null);
  }

  if (connected === null) return null; // initial token check in progress

  if (connected) {
    return (
      <View style={compact ? styles.rowCompact : styles.row}>
        <View style={[styles.btn, styles.btnConnected, compact && styles.btnCompact]}>
          <Text style={styles.spotifyIcon}>♫</Text>
          <Text style={[styles.btnText, styles.btnTextConnected]}>Spotify Connected</Text>
        </View>
        <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={compact ? styles.rowCompact : styles.row}>
      <TouchableOpacity
        style={[styles.btn, styles.btnConnect, compact && styles.btnCompact, connecting && styles.btnDisabled]}
        onPress={handleConnect}
        disabled={connecting}
      >
        <Text style={styles.spotifyIcon}>♫</Text>
        <Text style={styles.btnText}>
          {connecting ? "Opening Spotify..." : "Link Spotify"}
        </Text>
      </TouchableOpacity>
      {connecting && (
        <Text style={styles.connectingHint}>
          Complete login in browser, then return here
        </Text>
      )}
      {error && !connecting && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row:              { gap: 6 },
  rowCompact:       { flexDirection: "row", alignItems: "center", gap: 8 },
  btn:              { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
  btnCompact:       { paddingHorizontal: 12, paddingVertical: 8 },
  btnConnect:       { backgroundColor: "rgba(29,185,84,0.12)", borderColor: "rgba(29,185,84,0.4)" },
  btnConnected:     { backgroundColor: "rgba(29,185,84,0.06)", borderColor: "rgba(29,185,84,0.25)" },
  btnDisabled:      { opacity: 0.6 },
  spotifyIcon:      { color: "#1DB954", fontSize: 16, fontWeight: "900" },
  btnText:          { color: "#1DB954", fontSize: 13, fontWeight: "700" },
  btnTextConnected: { color: "#22c55e", fontSize: 13 },
  disconnectBtn:    { paddingVertical: 4 },
  disconnectText:   { color: "#555", fontSize: 11, textDecorationLine: "underline" },
  connectingHint:   { color: "#555", fontSize: 11 },
  errorText:        { color: "#f87171", fontSize: 11 },
});
