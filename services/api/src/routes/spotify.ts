import type { FastifyInstance } from "fastify"

const SPOTIFY_CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID     ?? ""
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? ""
const SPOTIFY_TOKEN_URL     = "https://accounts.spotify.com/api/token"
const SPOTIFY_SEARCH_URL    = "https://api.spotify.com/v1/search"

export async function spotifyRoutes(fastify: FastifyInstance) {

  // POST /spotify/token — exchange auth code for tokens (client secret stays server-side)
  fastify.post<{
    Body: { code: string; verifier: string; redirect_uri: string }
  }>("/spotify/token", {
    schema: {
      body: {
        type: "object",
        required: ["code", "verifier", "redirect_uri"],
        properties: {
          code:         { type: "string" },
          verifier:     { type: "string" },
          redirect_uri: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { code, verifier, redirect_uri } = request.body

    const params = new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri,
      client_id:     SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
      code_verifier: verifier,
    })

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return reply.code(400).send({ error: (err as any).error_description ?? "Token exchange failed" })
    }

    const data = await res.json() as {
      access_token: string; refresh_token: string; expires_in: number
    }

    return reply.send({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_in:    data.expires_in,
    })
  })

  // POST /spotify/refresh — refresh an expired access token
  fastify.post<{
    Body: { refresh_token: string }
  }>("/spotify/refresh", {
    schema: {
      body: {
        type: "object",
        required: ["refresh_token"],
        properties: { refresh_token: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const { refresh_token } = request.body

    const params = new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token,
      client_id:     SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    })

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    params.toString(),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return reply.code(400).send({ error: (err as any).error_description ?? "Token refresh failed" })
    }

    const data = await res.json() as {
      access_token: string; refresh_token?: string; expires_in: number
    }

    return reply.send({
      access_token:  data.access_token,
      refresh_token: data.refresh_token ?? refresh_token,
      expires_in:    data.expires_in,
    })
  })

  // GET /spotify/search?q=query — proxy to Spotify, return normalized tracks
  fastify.get<{
    Querystring: { q: string }
    Headers:     { authorization?: string }
  }>("/spotify/search", {
    schema: {
      querystring: {
        type: "object",
        required: ["q"],
        properties: { q: { type: "string", minLength: 1, maxLength: 100 } },
      },
    },
  }, async (request, reply) => {
    const { q }      = request.query
    const authHeader = request.headers["authorization"]

    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing Spotify access token" })
    }

    const accessToken = authHeader.slice(7)

    const params = new URLSearchParams({ q, type: "track", limit: "10", market: "US" })

    const res = await fetch(`${SPOTIFY_SEARCH_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      if (res.status === 401) return reply.code(401).send({ error: "SPOTIFY_TOKEN_EXPIRED" })
      return reply.code(res.status).send({ error: "Spotify API error" })
    }

    const data = await res.json() as {
      tracks: {
        items: Array<{
          id: string
          name: string
          artists: Array<{ name: string }>
          album: { name: string; images: Array<{ url: string }> }
          preview_url: string | null
          duration_ms: number
          external_ids: { isrc?: string }
        }>
      }
    }

    const tracks = (data.tracks?.items ?? []).map((item) => ({
      isrc:        item.external_ids?.isrc ?? item.id,
      name:        item.name,
      artist:      item.artists.map((a) => a.name).join(", "),
      album:       item.album.name,
      artwork_url: item.album.images[0]?.url ?? null,
      preview_url: item.preview_url,
      duration_ms: item.duration_ms,
    }))

    return reply.send({ tracks })
  })
}
