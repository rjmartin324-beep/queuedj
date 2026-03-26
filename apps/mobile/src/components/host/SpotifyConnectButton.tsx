import React, { useState, useEffect, useCallback, useRef } from "react"
import { TouchableOpacity, Text, StyleSheet, View, Alert, AppState, AppStateStatus } from "react-native"
import * as Linking from "expo-linking"
import {
  generateCodeVerifier, getAuthUrl, exchangeCode,
  getStoredTokens, clearSpotifyTokens, isTokenExpired, refreshSpotifyToken,
} from "../../lib/spotify"

// ─────────────────────────────────────────────────────────────────────────────
// SpotifyConnectButton (Host)
// Shows "Connect Spotify" when disconnected.
// Shows green "Spotify Connected" + disconnect option when live.
//
// Deep-link handling covers two paths:
//   A) Linking "url" event — fires when app is already open in background
//   B) Linking.getInitialURL() — fires when deep link cold-starts / resumes
//      the app (common on iOS/Android under memory pressure)
// Module-level verifier persists across component remounts (cold-start).
// AppState listener resets "loading" if user returns from browser empty-handed.
// ─────────────────────────────────────────────────────────────────────────────

// Persists across re-renders and component remounts (survives cold-start deep link)
let _hostPendingVerifier: string | null = null;

interface Props {
  onConnected?:    (accessToken: string) => void
  onDisconnected?: () => void
}

export function SpotifyConnectButton({ onConnected, onDisconnected }: Props) {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading]     = useState(false)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  // ── On mount: check stored tokens + catch deep link if cold-started ─────────
  useEffect(() => {
    getStoredTokens().then(async ({ accessToken, refreshToken, tokenExpiry }) => {
      if (!accessToken) return
      if (isTokenExpired(tokenExpiry)) {
        if (refreshToken) {
          try {
            const tokens = await refreshSpotifyToken(refreshToken)
            setIsConnected(true)
            onConnected?.(tokens.access_token)
          } catch {
            setIsConnected(false)
          }
        }
      } else {
        setIsConnected(true)
        onConnected?.(accessToken)
      }
    })

    // Catch deep link if the app was cold-started or resumed by the OS
    Linking.getInitialURL().then(url => {
      if (url) processCallback(url)
    }).catch(() => {})
  }, [])

  // ── Linking event: app was already running in background ────────────────────
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => processCallback(url))
    return () => sub.remove()
  }, [])

  // ── AppState: reset "loading" if user returns from browser empty-handed ──────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      const prev = appStateRef.current
      appStateRef.current = nextState
      if (prev === "background" && nextState === "active") {
        // Give the Linking event 800ms to fire first; if it hasn't, unlock
        setTimeout(() => {
          setIsLoading(loading => {
            if (loading) {
              // Still loading after returning — check if token was actually saved
              getStoredTokens().then(({ accessToken }) => {
                if (accessToken) {
                  setIsConnected(true)
                }
              })
              return false
            }
            return loading
          })
        }, 800)
      }
    })
    return () => sub.remove()
  }, [])

  async function processCallback(url: string) {
    if (!url.includes("auth/spotify/callback")) return
    if (!_hostPendingVerifier) return

    const { queryParams } = Linking.parse(url)
    const code  = queryParams?.code  as string | undefined
    const error = queryParams?.error as string | undefined

    if (error || !code) {
      setIsLoading(false)
      _hostPendingVerifier = null
      return
    }

    setIsLoading(true)
    try {
      const tokens = await exchangeCode(code, _hostPendingVerifier)
      _hostPendingVerifier = null
      setIsConnected(true)
      onConnected?.(tokens.access_token)
    } catch {
      Alert.alert("Spotify Error", "Could not connect. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = useCallback(async () => {
    setIsLoading(true)
    try {
      const cv  = generateCodeVerifier()
      _hostPendingVerifier = cv
      const url = await getAuthUrl(cv)
      await Linking.openURL(url)
    } catch {
      Alert.alert("Error", "Could not open Spotify login.")
      _hostPendingVerifier = null
      setIsLoading(false)
    }
  }, [])

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      "Disconnect Spotify?",
      "You will need to reconnect to search Spotify tracks.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect", style: "destructive",
          onPress: async () => {
            await clearSpotifyTokens()
            setIsConnected(false)
            onDisconnected?.()
          },
        },
      ],
    )
  }, [onDisconnected])

  if (isConnected) {
    return (
      <TouchableOpacity style={styles.connectedBtn} onPress={handleDisconnect}>
        <View style={styles.dot} />
        <Text style={styles.connectedText}>Spotify Connected</Text>
        <Text style={styles.disconnectHint}>tap to disconnect</Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      style={[styles.connectBtn, isLoading && styles.btnDisabled]}
      onPress={handleConnect}
      disabled={isLoading}
    >
      <Text style={styles.connectText}>{isLoading ? "Connecting…" : "Connect Spotify"}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  connectBtn:     { backgroundColor: "#1DB954", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center" },
  connectText:    { color: "#000", fontSize: 15, fontWeight: "700" },
  btnDisabled:    { opacity: 0.5 },
  connectedBtn:   { flexDirection: "row", alignItems: "center", backgroundColor: "#0a2e14", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "#1DB95455", gap: 8 },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1DB954" },
  connectedText:  { color: "#1DB954", fontSize: 14, fontWeight: "700", flex: 1 },
  disconnectHint: { color: "#555", fontSize: 11 },
})
