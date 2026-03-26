import AsyncStorage from "@react-native-async-storage/async-storage"
import { generateCodeVerifier, generateCodeChallenge, isTokenExpired } from "./spotify"

// ─────────────────────────────────────────────────────────────────────────────
// spotifyGuest.ts
//
// Separate Spotify OAuth flow for guests (different AsyncStorage keys so
// guest tokens never collide with host tokens on the same device).
// Scopes include playlist-read-private + user-library-read so guests can
// browse their own playlists and liked songs to find tracks to request.
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_ID    = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? ""
const REDIRECT_URI = "queuedj://auth/spotify/callback"
const API_URL      = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001"

const SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
].join(" ")

const KEYS = {
  accessToken:  "guest_spotify_access_token",
  refreshToken: "guest_spotify_refresh_token",
  tokenExpiry:  "guest_spotify_token_expiry",
} as const

// ─── Auth URL ─────────────────────────────────────────────────────────────────

export async function getGuestAuthUrl(verifier: string): Promise<string> {
  const challenge = await generateCodeChallenge(verifier)
  const params = new URLSearchParams({
    response_type:         "code",
    client_id:             CLIENT_ID,
    scope:                 SCOPES,
    redirect_uri:          REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge:        challenge,
  })
  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export { generateCodeVerifier }

// ─── Token Exchange + Storage ─────────────────────────────────────────────────

export async function exchangeGuestCode(code: string, verifier: string): Promise<string> {
  // PKCE uses no client secret — exchange directly with Spotify, no backend needed.
  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    code,
    redirect_uri:  REDIRECT_URI,
    client_id:     CLIENT_ID,
    code_verifier: verifier,
  })
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const tokens = await res.json()
  const expiry = Date.now() + tokens.expires_in * 1000
  await AsyncStorage.multiSet([
    [KEYS.accessToken,  tokens.access_token],
    [KEYS.refreshToken, tokens.refresh_token ?? ""],
    [KEYS.tokenExpiry,  String(expiry)],
  ])
  return tokens.access_token
}

export async function getGuestTokens() {
  const results = await AsyncStorage.multiGet([KEYS.accessToken, KEYS.refreshToken, KEYS.tokenExpiry])
  const map = Object.fromEntries(results.map(([k, v]) => [k, v]))
  return {
    accessToken:  map[KEYS.accessToken]  ?? null,
    refreshToken: map[KEYS.refreshToken] ?? null,
    tokenExpiry:  map[KEYS.tokenExpiry]  ? Number(map[KEYS.tokenExpiry]) : null,
  }
}

async function refreshGuestToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    refresh_token: refreshToken,
    client_id:     CLIENT_ID,
  })
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  })
  if (!res.ok) throw new Error("Refresh failed")
  const tokens = await res.json()
  const expiry = Date.now() + tokens.expires_in * 1000
  await AsyncStorage.multiSet([
    [KEYS.accessToken, tokens.access_token],
    [KEYS.tokenExpiry, String(expiry)],
  ])
  return tokens.access_token
}

export async function clearGuestTokens(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.accessToken, KEYS.refreshToken, KEYS.tokenExpiry])
}

/** Returns a valid (auto-refreshed) guest access token, or null if not connected. */
export async function getValidGuestToken(): Promise<string | null> {
  try {
    const { accessToken, refreshToken, tokenExpiry } = await getGuestTokens()
    if (!accessToken) return null
    if (!isTokenExpired(tokenExpiry)) return accessToken
    if (refreshToken) return await refreshGuestToken(refreshToken)
    return null
  } catch {
    return null
  }
}

// ─── Data Types ───────────────────────────────────────────────────────────────

export interface SpotifyPlaylist {
  id:         string
  name:       string
  trackCount: number
  imageUrl:   string | null
}

export interface SpotifyLibraryTrack {
  isrc:       string
  title:      string
  artist:     string
  album:      string | null
  artworkUrl: string | null
  durationMs: number
  previewUrl: string | null
}

// ─── Spotify Web API Calls ────────────────────────────────────────────────────

export async function fetchPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(res.status === 401 ? "SPOTIFY_TOKEN_EXPIRED" : "Failed to fetch playlists")
  }
  const data = await res.json()
  return (data.items ?? []).map((p: any) => ({
    id:         p.id,
    name:       p.name,
    trackCount: p.tracks?.total ?? 0,
    imageUrl:   p.images?.[0]?.url ?? null,
  }))
}

export async function fetchPlaylistTracks(token: string, playlistId: string): Promise<SpotifyLibraryTrack[]> {
  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50` +
    `&fields=items(track(id,name,artists,album,duration_ms,preview_url,external_ids))`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error("Failed to fetch playlist tracks")
  const data = await res.json()
  return (data.items ?? [])
    .filter((i: any) => i?.track)
    .map((i: any) => trackFromSpotify(i.track))
}

export async function fetchLikedSongs(token: string): Promise<SpotifyLibraryTrack[]> {
  const res = await fetch("https://api.spotify.com/v1/me/tracks?limit=50", {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to fetch liked songs")
  const data = await res.json()
  return (data.items ?? []).map((i: any) => trackFromSpotify(i.track))
}

function trackFromSpotify(t: any): SpotifyLibraryTrack {
  return {
    isrc:       t.external_ids?.isrc ?? `sp:${t.id}`,
    title:      t.name,
    artist:     t.artists?.[0]?.name ?? "Unknown",
    album:      t.album?.name ?? null,
    artworkUrl: t.album?.images?.[0]?.url ?? null,
    durationMs: t.duration_ms ?? 180000,
    previewUrl: t.preview_url ?? null,
  }
}
