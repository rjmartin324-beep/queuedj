import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, Modal, Animated, Easing, Alert,
} from "react-native"
import * as Linking from "expo-linking"
import {
  generateCodeVerifier, getGuestAuthUrl, exchangeGuestCode,
  getValidGuestToken, clearGuestTokens,
  fetchPlaylists, fetchPlaylistTracks, fetchLikedSongs,
  type SpotifyPlaylist, type SpotifyLibraryTrack,
} from "../../../lib/spotifyGuest"

// ─────────────────────────────────────────────────────────────────────────────
// GuestSpotifyLibrary
//
// A slide-up modal guests can open to browse their own Spotify playlists
// and liked songs. Tapping a track fires onRequestTrack — the parent
// (DJQueueView) runs the normal queue:request socket emit with that track.
//
// Spotify connect is optional — guests who skip just use search as before.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  visible:        boolean
  onClose:        () => void
  onRequestTrack: (track: SpotifyLibraryTrack) => void
}

type Tab = "playlists" | "liked"

export function GuestSpotifyLibrary({ visible, onClose, onRequestTrack }: Props) {
  const slideY = useRef(new Animated.Value(600)).current

  const [token,        setToken]        = useState<string | null>(null)
  const [verifier,     setVerifier]     = useState<string | null>(null)
  const [connecting,   setConnecting]   = useState(false)
  const [tab,          setTab]          = useState<Tab>("playlists")
  const [playlists,    setPlaylists]    = useState<SpotifyPlaylist[]>([])
  const [tracks,       setTracks]       = useState<SpotifyLibraryTrack[]>([])
  const [openPlaylist, setOpenPlaylist] = useState<SpotifyPlaylist | null>(null)
  const [loading,      setLoading]      = useState(false)

  // Slide in/out
  useEffect(() => {
    Animated.timing(slideY, {
      toValue:         visible ? 0 : 600,
      duration:        320,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [visible])

  // Check stored token on open
  useEffect(() => {
    if (!visible) return
    getValidGuestToken().then(t => { if (t) setToken(t) })
  }, [visible])

  // Deep-link OAuth callback
  useEffect(() => {
    const sub = Linking.addEventListener("url", async ({ url }) => {
      if (!url.includes("auth/spotify/callback")) return
      const { queryParams } = Linking.parse(url)
      const code = queryParams?.code as string | undefined
      if (!code || !verifier) return
      setConnecting(true)
      try {
        const t = await exchangeGuestCode(code, verifier)
        setToken(t)
      } catch {
        Alert.alert("Spotify Error", "Could not connect. Please try again.")
      } finally {
        setConnecting(false)
        setVerifier(null)
      }
    })
    return () => sub.remove()
  }, [verifier])

  // Load playlists once token is available
  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetchPlaylists(token)
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  // Load liked songs when tab switches
  useEffect(() => {
    if (!token || tab !== "liked" || tracks.length > 0) return
    setLoading(true)
    fetchLikedSongs(token)
      .then(setTracks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab, token])

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const cv  = generateCodeVerifier()
      setVerifier(cv)
      const url = await getGuestAuthUrl(cv)
      await Linking.openURL(url)
    } catch {
      Alert.alert("Error", "Could not open Spotify login.")
      setConnecting(false)
    }
  }, [])

  const handleDisconnect = useCallback(() => {
    Alert.alert("Disconnect Spotify?", "You'll go back to search only.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect", style: "destructive", onPress: async () => {
          await clearGuestTokens()
          setToken(null)
          setPlaylists([])
          setTracks([])
          setOpenPlaylist(null)
        },
      },
    ])
  }, [])

  async function openPlaylistDetail(playlist: SpotifyPlaylist) {
    if (!token) return
    setOpenPlaylist(playlist)
    setLoading(true)
    try {
      const t = await fetchPlaylistTracks(token, playlist.id)
      setTracks(t)
    } catch {
      setTracks([])
    } finally {
      setLoading(false)
    }
  }

  function handleRequest(track: SpotifyLibraryTrack) {
    onRequestTrack(track)
    onClose()
  }

  function handleBack() {
    setOpenPlaylist(null)
    setTracks([])
  }

  if (!visible) return null

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>

        {/* Handle + header */}
        <View style={styles.handle} />
        <View style={styles.header}>
          {openPlaylist ? (
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.headerTitle}>My Spotify</Text>
          )}
          {token && (
            <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>

        {!token ? (
          /* ── Connect prompt ── */
          <View style={styles.connectPrompt}>
            <Text style={styles.connectEmoji}>🎵</Text>
            <Text style={styles.connectTitle}>Connect Your Spotify</Text>
            <Text style={styles.connectBody}>Browse your playlists and liked songs to request tracks</Text>
            <TouchableOpacity
              style={[styles.connectBtn, connecting && styles.btnDisabled]}
              onPress={handleConnect}
              disabled={connecting}
            >
              <Text style={styles.connectBtnText}>
                {connecting ? "Connecting…" : "Connect Spotify"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip — use search instead</Text>
            </TouchableOpacity>
          </View>
        ) : openPlaylist ? (
          /* ── Playlist track list ── */
          <>
            <Text style={styles.playlistName} numberOfLines={1}>{openPlaylist.name}</Text>
            {loading ? (
              <ActivityIndicator color="#1DB954" style={styles.spinner} />
            ) : (
              <FlatList
                data={tracks}
                keyExtractor={(t, i) => t.isrc + i}
                renderItem={({ item }) => (
                  <TrackRow track={item} onPress={() => handleRequest(item)} />
                )}
                style={styles.list}
                ListEmptyComponent={<Text style={styles.emptyText}>No tracks found</Text>}
              />
            )}
          </>
        ) : (
          /* ── Playlists / Liked tabs ── */
          <>
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === "playlists" && styles.tabActive]}
                onPress={() => setTab("playlists")}
              >
                <Text style={[styles.tabText, tab === "playlists" && styles.tabTextActive]}>Playlists</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === "liked" && styles.tabActive]}
                onPress={() => setTab("liked")}
              >
                <Text style={[styles.tabText, tab === "liked" && styles.tabTextActive]}>Liked Songs</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color="#1DB954" style={styles.spinner} />
            ) : tab === "playlists" ? (
              <FlatList
                data={playlists}
                keyExtractor={(p) => p.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.playlistRow} onPress={() => openPlaylistDetail(item)}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.playlistArt} />
                    ) : (
                      <View style={[styles.playlistArt, styles.playlistArtPlaceholder]}>
                        <Text style={{ fontSize: 20 }}>🎵</Text>
                      </View>
                    )}
                    <View style={styles.playlistInfo}>
                      <Text style={styles.playlistRowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.playlistCount}>{item.trackCount} tracks</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                )}
                style={styles.list}
                ListEmptyComponent={<Text style={styles.emptyText}>No playlists found</Text>}
              />
            ) : (
              <FlatList
                data={tracks}
                keyExtractor={(t, i) => t.isrc + i}
                renderItem={({ item }) => (
                  <TrackRow track={item} onPress={() => handleRequest(item)} />
                )}
                style={styles.list}
                ListEmptyComponent={<Text style={styles.emptyText}>No liked songs found</Text>}
              />
            )}
          </>
        )}
      </Animated.View>
    </Modal>
  )
}

// ─── Track Row ────────────────────────────────────────────────────────────────

function TrackRow({ track, onPress }: { track: SpotifyLibraryTrack; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.trackRow} onPress={onPress} activeOpacity={0.7}>
      {track.artworkUrl ? (
        <Image source={{ uri: track.artworkUrl }} style={styles.trackArt} />
      ) : (
        <View style={[styles.trackArt, styles.trackArtPlaceholder]} />
      )}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
      </View>
      <View style={styles.requestPill}>
        <Text style={styles.requestPillText}>+ Add</Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    height:          "75%",
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderTopWidth:  1,
    borderTopColor:  "#1a1a1a",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#333",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },

  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerTitle:    { color: "#fff", fontSize: 17, fontWeight: "700" },
  backBtn:        { padding: 4 },
  backText:       { color: "#a78bfa", fontSize: 15, fontWeight: "600" },
  disconnectBtn:  { padding: 4 },
  disconnectText: { color: "#555", fontSize: 13 },

  // Connect prompt
  connectPrompt: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  connectEmoji:  { fontSize: 48 },
  connectTitle:  { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  connectBody:   { color: "#888", fontSize: 14, textAlign: "center", lineHeight: 20 },
  connectBtn:    {
    backgroundColor: "#1DB954", borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32,
    marginTop: 8, width: "100%", alignItems: "center",
  },
  connectBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  btnDisabled:    { opacity: 0.5 },
  skipBtn:        { padding: 8 },
  skipText:       { color: "#555", fontSize: 13 },

  // Tabs
  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 4 },
  tab: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, borderColor: "#222",
  },
  tabActive:     { backgroundColor: "#1DB95422", borderColor: "#1DB95466" },
  tabText:       { color: "#555", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#1DB954" },

  // Playlists
  list: { flex: 1 },
  playlistName: {
    color: "#fff", fontSize: 16, fontWeight: "700",
    paddingHorizontal: 20, paddingBottom: 8,
  },
  playlistRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#111", gap: 12,
  },
  playlistArt:         { width: 48, height: 48, borderRadius: 6 },
  playlistArtPlaceholder: { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  playlistInfo:        { flex: 1 },
  playlistRowName:     { color: "#fff", fontSize: 14, fontWeight: "600" },
  playlistCount:       { color: "#555", fontSize: 12, marginTop: 2 },
  chevron:             { color: "#444", fontSize: 18 },

  // Tracks
  trackRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#111", gap: 12,
  },
  trackArt:            { width: 44, height: 44, borderRadius: 6 },
  trackArtPlaceholder: { backgroundColor: "#1a1a1a" },
  trackInfo:           { flex: 1 },
  trackTitle:          { color: "#fff", fontSize: 14, fontWeight: "600" },
  trackArtist:         { color: "#666", fontSize: 12, marginTop: 2 },
  requestPill: {
    backgroundColor: "#6c47ff22", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "#6c47ff55",
  },
  requestPillText: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },

  spinner:   { marginTop: 40 },
  emptyText: { color: "#444", textAlign: "center", padding: 40, fontSize: 14 },
})
