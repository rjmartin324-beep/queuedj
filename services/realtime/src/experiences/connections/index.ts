import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Connections Experience
//
// Guests group 16 words into 4 categories. Each correct group submission
// earns +200 pts. 2 puzzles total.
//
// Actions:
//   HOST:  start, end_puzzle, end
//   GUEST: submit_group
// ─────────────────────────────────────────────────────────────────────────────

interface ConnectionGroup {
  label: string;
  items: string[];
  color: "yellow" | "green" | "blue" | "purple";
}

interface ConnectionPuzzle {
  groups: ConnectionGroup[];
}

const PUZZLES: ConnectionPuzzle[] = [
  {
    groups: [
      {
        label: "Things at a house party",
        color: "yellow",
        items: ["Solo cups", "Playlist", "Snacks", "Fairy lights"],
      },
      {
        label: "DJ equipment",
        color: "green",
        items: ["Turntable", "Mixer", "Crossfader", "Beatpad"],
      },
      {
        label: "___ drop",
        color: "blue",
        items: ["Bass", "Name", "Tear", "Rain"],
      },
      {
        label: "Party game brands",
        color: "purple",
        items: ["Jenga", "Twister", "Pictionary", "Taboo"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Music festival essentials",
        color: "yellow",
        items: ["Wristband", "Tent", "Poncho", "Earplugs"],
      },
      {
        label: "Types of music beat",
        color: "green",
        items: ["Four-on-the-floor", "Breakbeat", "Boom bap", "Trap"],
      },
      {
        label: "___ crowd",
        color: "blue",
        items: ["Flash", "Home", "Wild", "Tough"],
      },
      {
        label: "Sounds a crowd makes",
        color: "purple",
        items: ["Cheer", "Clap", "Chant", "Roar"],
      },
    ],
  },
];

interface ConnectionsState {
  phase: "waiting" | "playing" | "finished";
  scores: Record<string, number>;
  puzzleIndex: number;
  solved: string[][]; // arrays of solved group items
  mistakes: Record<string, number>; // guestId → mistake count
  solvedGroups: ConnectionGroup[]; // full solved group objects
}

const KEY = (roomId: string) => `experience:connections:${roomId}`;

/** Normalise for comparison — trim + lowercase */
function normalise(s: string): string {
  return s.trim().toLowerCase();
}

/** Check if two string arrays contain the same values (order independent) */
function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map(normalise));
  for (const item of b) {
    if (!setA.has(normalise(item))) return false;
  }
  return true;
}

export class ConnectionsExperience implements ExperienceModule {
  readonly type = "connections" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: ConnectionsState = {
      phase: "waiting",
      scores: {},
      puzzleIndex: 0,
      solved: [],
      mistakes: {},
      solvedGroups: [],
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: ConnectionsState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "playing";
        state.puzzleIndex = 0;
        state.solved = [];
        state.solvedGroups = [];
        state.mistakes = {};
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const puzzle = PUZZLES[0];
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "connections",
          state,
          view: { type: "connections", data: { ...state, puzzle } },
          sequenceId: seq,
        });
        break;
      }

      case "submit_group": {
        if (state.phase !== "playing") return;
        const p = payload as { items: string[] };
        if (!Array.isArray(p?.items) || p.items.length !== 4) return;
        const puzzle = PUZZLES[state.puzzleIndex];
        if (!puzzle) return;

        // Check if already solved
        const alreadySolved = state.solved.some(g => setsEqual(g, p.items));
        if (alreadySolved) return;

        // Check if it's a valid group
        const matchedGroup = puzzle.groups.find(g => setsEqual(g.items, p.items));
        if (matchedGroup) {
          // Correct!
          state.solved.push([...matchedGroup.items]);
          state.solvedGroups.push(matchedGroup);
          state.scores[guestId] = (state.scores[guestId] ?? 0) + 200;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "connections",
            state,
            view: { type: "connections", data: { ...state, puzzle, lastResult: { correct: true, guestId, group: matchedGroup } } },
            sequenceId: seq,
          });
        } else {
          // Wrong
          state.mistakes[guestId] = (state.mistakes[guestId] ?? 0) + 1;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "connections",
            state,
            view: { type: "connections", data: { ...state, puzzle, lastResult: { correct: false, guestId } } },
            sequenceId: seq,
          });
        }
        break;
      }

      case "end_puzzle": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "playing") return;
        const nextIndex = state.puzzleIndex + 1;
        if (nextIndex >= PUZZLES.length) {
          // All puzzles done
          state.phase = "finished";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "connections",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          state.puzzleIndex = nextIndex;
          state.solved = [];
          state.solvedGroups = [];
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const puzzle = PUZZLES[nextIndex];
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "connections",
            state,
            view: { type: "connections", data: { ...state, puzzle } },
            sequenceId: seq,
          });
        }
        break;
      }

      case "end": {
        if (role !== "HOST") return;
        await this.onDeactivate(roomId);
        await redisClient.set(`room:${roomId}:experience`, "dj");
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:changed" as any, {
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: seq,
        });
        break;
      }
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: ConnectionsState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    const puzzle = PUZZLES[state.puzzleIndex] ?? null;
    return { type: "connections" as any, data: { ...state, puzzle } };
  }
}
