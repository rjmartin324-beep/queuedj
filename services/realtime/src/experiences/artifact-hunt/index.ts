import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactHunt Experience — QR Scavenger Hunt
//
// Host hides QR stickers around the venue before the game.
// Each QR code is tied to an artifact. Guests follow clues → scan QR → score.
// Clues unlock sequentially. First find = bonus points.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:artifact_hunt:${roomId}`;

const HINT_UNLOCK_MS = 3 * 60 * 1000; // 3 min before hint unlocks
const POINTS_FIRST  = 500;
const POINTS_FIND   = 200;
const POINTS_HINT   = 100; // reduced points after hint used

interface Artifact {
  id:         string;
  name:       string;
  emoji:      string;
  clue:       string;
  hint:       string;
  qrCode:     string;  // unique token tied to QR sticker
  placement:  string;  // host-visible location description
  foundBy:    string[];  // guestIds in order
  foundNames: string[];
  unlockedAt: number | null;
}

interface ArtifactHuntState {
  phase:        "setup" | "hunting" | "ended";
  artifacts:    Artifact[];
  scores:       Record<string, number>;
  playerNames:  Record<string, string>;
  startedAt:    number | null;
  durationMs:   number;
}

// Default artifact set — host can customise placement descriptions via setup
const DEFAULT_ARTIFACTS: Omit<Artifact, "foundBy" | "foundNames" | "unlockedAt">[] = [
  {
    id: "a1", name: "The Stone Idol", emoji: "🗿",
    clue: "Where things get cold and food sleeps — look behind the tallest guardian.",
    hint: "Think about where you keep drinks cold at a party.",
    qrCode: "AH_A1", placement: "Behind the fridge / tallest bottle",
  },
  {
    id: "a2", name: "Ancient Compass", emoji: "🧭",
    clue: "I point the way but never move. Find me where the view is widest.",
    hint: "Look near a window or somewhere with a panoramic view.",
    qrCode: "AH_A2", placement: "Under the window ledge",
  },
  {
    id: "a3", name: "Ancient Scroll", emoji: "📜",
    clue: "I sit where words are kept and silence is enforced. Find me between two worlds of paper.",
    hint: "Books live here.",
    qrCode: "AH_A3", placement: "Between books on the shelf",
  },
  {
    id: "a4", name: "Crystal Gem", emoji: "💎",
    clue: "I reflect light but hold no image. Find me where entertainment lives.",
    hint: "Look near the TV or entertainment area.",
    qrCode: "AH_A4", placement: "Behind the TV / media unit",
  },
  {
    id: "a5", name: "Golden Dagger", emoji: "🗡️",
    clue: "Comfort surrounds me but I stay hidden. Seek the softest seat in the room.",
    hint: "Under a couch cushion.",
    qrCode: "AH_A5", placement: "Under left couch cushion (final artifact)",
  },
];

export class ArtifactHuntExperience implements ExperienceModule {
  readonly type = "artifact_hunt" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const state: ArtifactHuntState = {
      phase: "setup",
      artifacts: DEFAULT_ARTIFACTS.map(a => ({ ...a, foundBy: [], foundNames: [], unlockedAt: null })),
      scores: {},
      playerNames: {},
      startedAt: null,
      durationMs: 15 * 60 * 1000, // 15 min
    };
    await this._save(roomId, state);
  }

  async onDeactivate(_roomId: string): Promise<void> {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      case "start_hunt":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startHunt(roomId, p.playerNames ?? {}, io);
        break;

      case "scan_qr":
        await this._scanQR(roomId, guestId, p.qrCode, p.guestName ?? "Guest", io);
        break;

      case "update_placement":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._updatePlacement(roomId, p.artifactId, p.placement, io);
        break;

      case "end_hunt":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._endHunt(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    const now = Date.now();
    return {
      view: "artifact_hunt",
      data: {
        phase: state.phase,
        artifacts: state.artifacts.map((a, i) => {
          const prevFound = i === 0 || state.artifacts[i - 1].foundBy.length > 0;
          const isActive = prevFound && a.foundBy.length === 0;
          const isLocked = !prevFound;
          const hintAvailable = isActive && a.unlockedAt !== null && now >= (a.unlockedAt + HINT_UNLOCK_MS);
          return {
            id: a.id,
            name: a.name,
            emoji: a.emoji,
            clue: isLocked ? null : a.clue,
            hint: hintAvailable ? a.hint : null,
            status: a.foundBy.length > 0 ? "found" : isActive ? "active" : "locked",
            foundBy: a.foundNames,
            foundCount: a.foundBy.length,
          };
        }),
        scores: state.scores,
        playerNames: state.playerNames,
        startedAt: state.startedAt,
        durationMs: state.durationMs,
        totalArtifacts: state.artifacts.length,
        foundCount: state.artifacts.filter(a => a.foundBy.length > 0).length,
      },
    };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  // Host view — shows all placements including unfound
  async getHostViewData(roomId: string): Promise<unknown> {
    const state = await this._load(roomId);
    return {
      artifacts: state.artifacts.map(a => ({
        id: a.id, name: a.name, emoji: a.emoji,
        placement: a.placement,
        qrCode: a.qrCode,
        foundBy: a.foundNames,
        found: a.foundBy.length > 0,
      })),
      scores: state.scores,
      playerNames: state.playerNames,
    };
  }

  private async _startHunt(roomId: string, playerNames: Record<string, string>, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.phase = "hunting";
    state.playerNames = playerNames;
    state.startedAt = Date.now();
    // Unlock first artifact
    state.artifacts[0].unlockedAt = Date.now();
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "hunting",
      startedAt: state.startedAt,
      durationMs: state.durationMs,
    });
    // Auto-end after duration
    clearTimeout(this.timers.get(`${roomId}:end`));
    this.timers.set(`${roomId}:end`, setTimeout(() => this._endHunt(roomId, io), state.durationMs));
  }

  private async _scanQR(roomId: string, guestId: string, qrCode: string, guestName: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "hunting") return;

    const artifactIdx = state.artifacts.findIndex(a => a.qrCode === qrCode);
    if (artifactIdx === -1) {
      io.to(guestId).emit("artifact_hunt:wrong_qr");
      return;
    }

    const artifact = state.artifacts[artifactIdx];
    const alreadyFound = artifact.foundBy.includes(guestId);
    if (alreadyFound) return;

    const isFirst = artifact.foundBy.length === 0;
    const pts = isFirst ? POINTS_FIRST : POINTS_FIND;

    artifact.foundBy.push(guestId);
    artifact.foundNames.push(guestName);
    state.scores[guestId] = (state.scores[guestId] ?? 0) + pts;
    state.playerNames[guestId] = guestName;

    // Unlock next artifact
    if (isFirst && artifactIdx + 1 < state.artifacts.length) {
      state.artifacts[artifactIdx + 1].unlockedAt = Date.now();
    }

    await this._save(roomId, state);

    io.to(guestId).emit("artifact_hunt:found", {
      artifact: { id: artifact.id, name: artifact.name, emoji: artifact.emoji },
      pts,
      isFirst,
    });

    io.to(roomId).emit("artifact_hunt:artifact_found", {
      artifactId: artifact.id,
      artifactName: artifact.name,
      emoji: artifact.emoji,
      guestName,
      isFirst,
      pts,
      scores: state.scores,
    });
  }

  private async _updatePlacement(roomId: string, artifactId: string, placement: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    const artifact = state.artifacts.find(a => a.id === artifactId);
    if (artifact) artifact.placement = placement;
    await this._save(roomId, state);
  }

  private async _endHunt(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase === "ended") return;
    state.phase = "ended";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "ended",
      scores: state.scores,
      playerNames: state.playerNames,
      artifacts: state.artifacts.map(a => ({ id: a.id, name: a.name, emoji: a.emoji, foundBy: a.foundNames })),
    });
  }

  private async _load(roomId: string): Promise<ArtifactHuntState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : { phase: "setup", artifacts: [], scores: {}, playerNames: {}, startedAt: null, durationMs: 900000 };
  }

  private async _save(roomId: string, state: ArtifactHuntState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}