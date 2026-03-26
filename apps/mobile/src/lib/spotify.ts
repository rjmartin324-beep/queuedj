import AsyncStorage from "@react-native-async-storage/async-storage"

const API_URL      = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001"
const CLIENT_ID    = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? ""
const REDIRECT_URI = "queuedj://auth/spotify/callback"
const SCOPES       = ["user-read-private", "user-read-email"].join(" ")

export const SPOTIFY_KEYS = {
  accessToken:  "spotify_access_token",
  refreshToken: "spotify_refresh_token",
  tokenExpiry:  "spotify_token_expiry",
} as const

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  let result = ""
  for (let i = 0; i < 128; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data   = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes  = new Uint8Array(digest)
  let binary = ""
  bytes.forEach((b) => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

export async function getAuthUrl(verifier: string): Promise<string> {
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

// ─── Token management ─────────────────────────────────────────────────────────

export interface SpotifyTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function exchangeCode(code: string, verifier: string): Promise<SpotifyTokens> {
  const res = await fetch(`${API_URL}/spotify/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ code, verifier, redirect_uri: REDIRECT_URI }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error((e as any).error ?? "Token exchange failed")
  }
  const tokens: SpotifyTokens = await res.json()
  await storeTokens(tokens)
  return tokens
}

export async function refreshSpotifyToken(refresh_token: string): Promise<SpotifyTokens> {
  const res = await fetch(`${API_URL}/spotify/refresh`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ refresh_token }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error((e as any).error ?? "Token refresh failed")
  }
  const tokens: SpotifyTokens = await res.json()
  await storeTokens(tokens)
  return tokens
}

async function storeTokens(tokens: SpotifyTokens): Promise<void> {
  const expiry = Date.now() + tokens.expires_in * 1000
  await AsyncStorage.multiSet([
    [SPOTIFY_KEYS.accessToken,  tokens.access_token],
    [SPOTIFY_KEYS.refreshToken, tokens.refresh_token],
    [SPOTIFY_KEYS.tokenExpiry,  String(expiry)],
  ])
}

export async function getStoredTokens() {
  const results = await AsyncStorage.multiGet([
    SPOTIFY_KEYS.accessToken,
    SPOTIFY_KEYS.refreshToken,
    SPOTIFY_KEYS.tokenExpiry,
  ])
  const map = Object.fromEntries(results.map(([k, v]) => [k, v]))
  return {
    accessToken:  map[SPOTIFY_KEYS.accessToken]  ?? null,
    refreshToken: map[SPOTIFY_KEYS.refreshToken] ?? null,
    tokenExpiry:  map[SPOTIFY_KEYS.tokenExpiry] ? Number(map[SPOTIFY_KEYS.tokenExpiry]) : null,
  }
}

export function isTokenExpired(tokenExpiry: number | null): boolean {
  if (!tokenExpiry) return true
  return Date.now() > tokenExpiry - 60_000
}

export async function clearSpotifyTokens(): Promise<void> {
  await AsyncStorage.multiRemove([
    SPOTIFY_KEYS.accessToken,
    SPOTIFY_KEYS.refreshToken,
    SPOTIFY_KEYS.tokenExpiry,
  ])
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  isrc:        string
  name:        string
  artist:      string
  album:       string
  artwork_url: string | null
  preview_url: string | null
  duration_ms: number
}

export async function searchTracks(query: string, accessToken: string): Promise<SpotifyTrack[]> {
  const res = await fetch(`${API_URL}/spotify/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error("SPOTIFY_TOKEN_EXPIRED")
    throw new Error("Spotify search failed")
  }
  const data = await res.json()
  return (data.tracks ?? []) as SpotifyTrack[]
}
