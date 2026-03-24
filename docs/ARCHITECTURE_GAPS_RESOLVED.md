# Architecture Gaps — Resolution Status

## ARCHITECTURE GAPS

### ✅ Job Queue (Redis/BullMQ) — RESOLVED
- `services/api/src/queue/bullmq.ts`
- 4 priority queues: critical / high / normal / low
- Python ML service consumes via `workers/bullmq_consumer.py`
- Job deduplication by ISRC prevents re-analysis
- Graceful fallback: if critical job times out, caller uses rule-based logic

### ✅ State Reconciliation — RESOLVED
- `services/realtime/src/rooms/stateReconciliation.ts`
- Every room event gets a monotonically increasing sequenceId
- On reconnect: client sends `lastSequenceId`
- Gap ≤ 100: replay missed events (delta sync, fast)
- Gap > 100: send full state snapshot
- Events stored in Redis as capped list (200 events per room)
- Mobile: `src/lib/socket.ts` persists `lastSequenceId` in AsyncStorage across app restarts

### ✅ Backend Database — RESOLVED
- PostgreSQL: tracks, sessions, session_tracks, RLHF signals, style profiles, licensing audit, model versions
- DynamoDB (Phase 6): live room state, queue, crowd state (currently in Redis for MVP)
- See `services/api/src/db/schema.sql`

### ✅ WebSocket Scaling — RESOLVED
- `services/realtime/src/index.ts` uses `@socket.io/redis-adapter` from Day 1
- Two Redis clients: pubClient (publish) + subClient (subscribe)
- Adding a second server instance requires zero code changes — just add to load balancer
- Rate limiting per socket prevents abuse even at scale

### ⏳ Streaming/Broadcast Pipeline — PHASE 6
- Decision: mediasoup for WebRTC P2P, RTMP for external stream output
- Architecture: Audio Engine (host device) → RTMP encoder → mediasoup SFU → Twitch/YouTube
- Not implemented in Phase 0. Placeholder in Output/Audio Engine spec.

### ✅ Audio File Sourcing — RESOLVED (Decision Made)
- MVP: Local files only via `expo-document-picker` + `expo-media-library`
- App is a DJ tool (like Serato) — host brings their own music
- DRM files from streaming services: explicitly out of scope
- Phase 2: Integrate Soundtrack Your Brand / Pretzel for licensed streaming
- Legal review required before any streaming API integration

---

## PRODUCT/UX GAPS

### ✅ Host Onboarding — ARCHITECTURE DEFINED
- Onboarding flow: 3 steps on first launch
  1. "What's your vibe tonight?" → pick VibePreset
  2. "Import your music" → expo-media-library scan OR manual file picker
  3. "Create your room" → auto-generates code and QR
- Hybrid Assist Mode tutorial: shown first time AI makes a suggestion

### ✅ Guest Experience (No Account/No Library) — DEFINED
- Guest joins: QR scan or 4-digit code → no login required
- Capabilities with zero setup:
  - See what's playing
  - Vote (up/down) on current track
  - Respond to Push Polls
  - Send Shout-Outs
  - Tap to Sync (beat tapping)
  - Aura Search (mood-based, no library needed)
- Optional: Link Spotify/Apple for "Your Hits" tab (OAuth PKCE, 1hr token)
- JSON import: paste Spotify Wrapped or playlist export for permanent library

### ✅ Queue Slot Conflict Resolution — DEFINED
- Two guests can't hold the same slot simultaneously
- Server-side: queue position is atomic (Redis MULTI/EXEC)
- If collision: first writer wins, second gets `queue:item_rejected` with next available position
- Vibe Credits (Phase 5): guests earn credits for dancing/upvotes, spend to bump queue

### ✅ Role System — IMPLEMENTED
- HOST: full control (see `shared-types/src/index.ts` ROLE_PERMISSIONS)
- CO_HOST: queue management + vibe setting, no playback controls
- GUEST: search, request, vote only
- Co-DJ: HOST can promote any GUEST to CO_HOST via `guest:promote` event
- See `services/realtime/src/handlers/roles.ts`

### ✅ Offline Mode — DEFINED
- Wi-Fi drops:
  1. Playback CONTINUES (local Superpowered audio engine, no internet needed)
  2. Queue FREEZES (no new requests accepted — socket offline)
  3. AI runs RULE-BASED FALLBACK only (no ML API calls)
  4. Pending guest requests buffered in `offlineState.pendingRequests`
- On reconnect:
  1. Socket reconnects with lastSequenceId
  2. Server replays missed events or sends full snapshot
  3. Pending requests are replayed
  4. Host sees "Room recovered after offline" notification
- See `apps/mobile/src/lib/socket.ts`

---

## LEGAL/COMPLIANCE GAPS

### ✅ DRM + Streaming API Terms — DECISION MADE
- MVP: local files only. No streaming API playback.
- Legal review required before Phase 2.
- Soundtrack Your Brand / Pretzel for Phase 2 venue licensing.

### ⏳ No-Derivative ISRC Database — PHASE 6
- No public database exists. Options:
  1. Audible Magic / Pex (commercial contract, $$$)
  2. Build conservative internal list from known restrictive labels
- Phase 0-5: assume all tracks are no-derivative until proven otherwise
- `no_derivative = FALSE` default in schema, but flip to TRUE for flagged ISRCs manually

### ✅ GDPR/CCPA — ARCHITECTURE DEFINED
- No account = no personal data by design
- RLHF signals: anonymized (session_id only, no guestId, no deviceId, no IP)
- Retention: 90 days then auto-deleted (see `cleanup_expired_data()` in schema)
- Feature flag: `FEATURE_RLHF_LOGGING=false` until legal review complete
- Opt-out toggle required before RLHF goes live

### ✅ RLHF Data Ownership — DEFINED
- ToS must state: anonymized session data used to improve AI recommendations
- No identity linking, no selling, 90-day retention
- Opt-out: host-level toggle per session
- See `.env.example` for `FEATURE_RLHF_LOGGING` flag

### ✅ DJ Mix Scraping — DECISION MADE
- DO NOT scrape commercial DJ mixes for Style DNA training
- Training data = voluntary user session data only
- Phase 7: negotiate direct licensing with select DJ labels for reference style DNA

---

## ML/AI GAPS

### ✅ Cold Start Problem — RESOLVED
- New session, no history → rule-based fallback always active
- Default: WARMUP state, BPM target 95, energy 0.3
- Crowd State Machine v1 is fully rule-based (Phase 0-3)
- ML model is an enhancement layered on top, never a dependency
- `transition_analysis.py`: returns neutral 0.5 score when track data missing

### ⏳ Model Versioning + A/B Testing — PHASE 4
- `model_versions` table in PostgreSQL: tracks active/shadow/inactive versions
- Shadow mode: new model runs but doesn't act — results logged for comparison
- Rollout strategy: shadow → 10% → 50% → 100%
- A/B testing: assign rooms to model version at session start

### ✅ Transition Classifier — SPEC DEFINED
- Classifies: transition TYPE (cut/crossfade/echo_out/harmonic_blend/filter_sweep/bridge)
- Phase 0-3: rule-based (BPM delta + Camelot + energy → recommended_transition)
- Phase 4+: ML classifier trained on RLHF signal pairs
- Output: transition type + confidence + sandbox score (5 axes)
- See `workers/transition_analysis.py`

### ⏳ Crowd Simulation — PHASE 7
- For synthetic battle-testing before model deployment
- Distribution: model party archetypes (club night, house party, wedding, festival)
- Energy curves follow time-of-night sigmoid: low → peak → gradual descent
- BPM distribution per archetype: club (120-135), house (95-110), etc.
- Discriminator AI scores mix quality; DJ AI learns from failures

### ⏳ Professional Style DNA — PHASE 7
- No legal pathway for scraping pro DJ mixes
- Alternative: partner with DJ schools/labels for voluntary contribution
- Internal: build from user sessions after 10,000+ sessions collected

---

## INFRASTRUCTURE GAPS

### ✅ Push Notifications — ARCHITECTURE DEFINED
- Expo Push Notification Service (wraps FCM + APNs) — single API for both platforms
- Push token registration: guest registers on join if they grant permission
- Stored in Redis per member (never PostgreSQL — ephemeral)
- Used for: Push Polls (30-min intervals), room notifications
- Implementation: Phase 2

### ✅ ISRC Fingerprint DB Seed — DEFINED
- Source 1: AcoustID (free, requires API key)
- Source 2: MusicBrainz (free, rate-limited to 1 req/sec)
- Source 3: Librosa local analysis fallback
- Source 4: Spotify audio features API (when available, rate-limited)
- Self-populating: every track loaded in any session adds to the DB
- See `workers/audio_analysis.py` + `workers/isrc_lookup.py`

### ✅ Rate Limiting — IMPLEMENTED
- REST: `@fastify/rate-limit` plugin (5 room creates/hr per IP)
- Socket.io: per-socket event rate limiter (see `services/realtime/src/index.ts`)
- Limits: queue:request 10/min, vote 1/sec, tap:beat 2/sec, shoutout 5/min

### ✅ Look-Ahead Buffer Memory — PROFILING REQUIRED
- 2 decks × 30s × 44100Hz × 32-bit × 2ch = ~42MB (stereo, no stems)
- With 4 stems: ~85MB total
- Profile on iPhone 12 (3GB RAM) and a mid-range Android (4GB RAM)
- If memory pressure detected: reduce look-ahead to 15s
- Stems disabled by default (FEATURE_STEM_SEPARATION=false)
- See LOOKAHEAD_BUFFER_SECONDS in `.env.example`

---

## ADDITIONAL GAPS IDENTIFIED (NEW)

### ⚠️ Superpowered SDK Cost — ACTION REQUIRED
- Contact Superpowered sales before committing
- Interim: react-native-track-player for MVP scaffolding
- Budget estimate: $500–$5,000/year for commercial license

### ⚠️ Backend Database Final Selection — DECIDED
- MVP: PostgreSQL only (via asyncpg + pg)
- Phase 6: Add DynamoDB for high-write room/queue state
- Connection pooling: max 20 connections per service in production

### ⚠️ Global Clock Sync (PTP) — PHASE 6
- Required for distributed edge compute to guest phones
- MVP: NTP-based timestamps with client-side jitter compensation
- See `serverTimestamp` in `RoomStateSnapshot` — used to correct clock drift

### ⚠️ Content ID Integration — PHASE 6
- Audible Magic or Pex (commercial contract required)
- Phase 0-5: internal Licensing Guardian (ISRC flag check only)
- No automated content ID checking until contract is signed

### ⚠️ Haptic Sync Latency — PRODUCT DECISION REQUIRED
- Consumer Bluetooth: 20–100ms latency
- Beat at 120 BPM = 500ms window
- ±50ms offset = perceptible but tolerable for most users
- Decision: ship as best-effort, document latency tolerance in-app
