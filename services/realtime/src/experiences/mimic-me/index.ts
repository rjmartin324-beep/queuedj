import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

interface MimicMeState {
  phase: "waiting" | "studying" | "performing" | "rating" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPerformer: string | null;
  action: { emoji: string; instruction: string } | null;
  ratings: Record<string, number>;
  performerOrder: string[];
  usedActionIndices: number[];
}

const ACTIONS = [
  { emoji: "🤸", instruction: "Do a jumping jack in slow motion" },
  { emoji: "🦁", instruction: "Roar like a lion for 3 seconds" },
  { emoji: "🤖", instruction: "Walk like a robot for 5 steps" },
  { emoji: "🧘", instruction: "Hold a yoga pose for 5 seconds" },
  { emoji: "🕺", instruction: "Do your best disco move" },
  { emoji: "🐧", instruction: "Waddle like a penguin in a circle" },
  { emoji: "🎤", instruction: "Mime singing into a microphone dramatically" },
  { emoji: "🥊", instruction: "Shadow box for 5 seconds" },
  { emoji: "🦋", instruction: "Flutter around like a butterfly" },
  { emoji: "🏄", instruction: "Surf an imaginary wave" },
  // ── added to reach 50 ────────────────────────────────────────────────────────
  { emoji: "🐊", instruction: "Crawl across the floor like a crocodile" },
  { emoji: "🦒", instruction: "Stretch your neck as tall as possible and look around slowly" },
  { emoji: "🕷️", instruction: "Scuttle sideways like a spider for 5 steps" },
  { emoji: "🐸", instruction: "Do three frog jumps" },
  { emoji: "🐒", instruction: "Swing your arms and walk like a gorilla" },
  { emoji: "🦅", instruction: "Spread your arms and glide slowly around the room" },
  { emoji: "🐢", instruction: "Move as slowly as humanly possible for 10 seconds" },
  { emoji: "🦘", instruction: "Hop on one leg across the room and back" },
  { emoji: "🦩", instruction: "Stand on one leg with your arms out for 5 seconds" },
  { emoji: "🐍", instruction: "Slither along the floor like a snake" },
  { emoji: "👻", instruction: "Float around the room like a ghost, making spooky sounds" },
  { emoji: "🤡", instruction: "Do a silly walk across the room" },
  { emoji: "🧟", instruction: "Walk like a zombie with arms out for 10 steps" },
  { emoji: "💃", instruction: "Do a dramatic flamenco stomp and spin" },
  { emoji: "🎭", instruction: "Act out being trapped in an invisible box" },
  { emoji: "🎬", instruction: "Do your best slow-motion action movie fall" },
  { emoji: "🥁", instruction: "Air drum a full 10-second drum solo" },
  { emoji: "🎻", instruction: "Play an invisible violin dramatically" },
  { emoji: "🏋️", instruction: "Pretend to lift an impossibly heavy barbell" },
  { emoji: "⛷️", instruction: "Ski down an imaginary slope with poles" },
  { emoji: "🧗", instruction: "Mime climbing a rock face for 10 seconds" },
  { emoji: "🎣", instruction: "Cast and reel in a fish dramatically" },
  { emoji: "🧹", instruction: "Ride an imaginary broomstick around the room" },
  { emoji: "🛸", instruction: "Walk like you've just landed from another planet" },
  { emoji: "🤠", instruction: "Do your best cowboy swagger and point at someone" },
  { emoji: "🧙", instruction: "Cast a dramatic spell using both hands" },
  { emoji: "🦸", instruction: "Strike your best superhero landing pose and hold it" },
  { emoji: "🎪", instruction: "Walk an imaginary tightrope across the room" },
  { emoji: "🎠", instruction: "Be a horse on a merry-go-round for 5 seconds" },
  { emoji: "🪩", instruction: "Do your best 70s disco move with a point to the sky" },
  { emoji: "🥴", instruction: "Walk around as if the floor is made of jelly" },
  { emoji: "🤿", instruction: "Mime swimming through deep water in slow motion" },
  { emoji: "🪆", instruction: "Move only in rigid, jointed puppet movements for 5 steps" },
  { emoji: "🏇", instruction: "Gallop around the room like a jockey riding a horse" },
  { emoji: "🧸", instruction: "Walk around stiff-armed like a teddy bear" },
  { emoji: "🎩", instruction: "Do your best magician bow and 'ta-daa' reveal" },
];

const KEY = (roomId: string) => `experience:mimic_me:${roomId}`;

export class MimicMeExperience implements ExperienceModule {
  readonly type = "mimic_me" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: MimicMeState = {
      phase: "waiting", round: 0, totalRounds: 6,
      scores: {}, currentPerformer: null, action: null, ratings: {}, performerOrder: [],
      usedActionIndices: [],
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string; guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: MimicMeState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const guestIds = (payload as any).guestIds as string[] ?? [];
        state.performerOrder = [...guestIds];
        state.round = 1;
        state.totalRounds = Math.min(guestIds.length * 2, 6);
        state.currentPerformer = guestIds[0] ?? null;
        state.usedActionIndices = [];
        const _firstPool = ACTIONS.map((_, i) => i);
        const _firstIdx = _firstPool[Math.floor(Math.random() * _firstPool.length)];
        state.usedActionIndices = [_firstIdx];
        state.action = ACTIONS[_firstIdx];
        state.ratings = {};
        state.phase = "studying";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "mimic_me", state,
          view: { type: "mimic_me" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "start_perform": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "performing";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "mimic_me", state,
          view: { type: "mimic_me" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "rate": {
        if (state.phase !== "performing" && state.phase !== "rating") return;
        if (guestId === state.currentPerformer) return;
        state.ratings[guestId] = (payload as any).rating as number ?? 0;
        state.phase = "rating";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "mimic_me", state,
          view: { type: "mimic_me" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const ratingVals = Object.values(state.ratings);
        const avg = ratingVals.length > 0
          ? ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length : 0;
        if (state.currentPerformer) {
          state.scores[state.currentPerformer] = (state.scores[state.currentPerformer] ?? 0) + Math.round(avg);
        }
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "mimic_me", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          const nextIdx = (state.round - 1) % state.performerOrder.length;
          state.currentPerformer = state.performerOrder[nextIdx];
          const _remaining = ACTIONS.map((_, i) => i).filter(i => !state.usedActionIndices.includes(i));
          const _pool = _remaining.length > 0 ? _remaining : ACTIONS.map((_, i) => i);
          const _idx = _pool[Math.floor(Math.random() * _pool.length)];
          state.usedActionIndices = _remaining.length > 0 ? [...state.usedActionIndices, _idx] : [_idx];
          state.action = ACTIONS[_idx];
          state.ratings = {};
          state.phase = "studying";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "mimic_me", state,
            view: { type: "mimic_me" as any, data: state }, sequenceId: seq,
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
          experienceType: "dj", view: { type: "dj_queue" }, sequenceId: seq,
        });
        break;
      }
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: MimicMeState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "mimic_me" as any, data: state };
  }
}
