import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

interface PartyDiceState {
  phase: "waiting" | "rolling" | "action" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentRoller: string | null;
  diceValue: number | null;
  currentAction: { desc: string; pts: number; emoji: string } | null;
  rollerOrder: string[];
}

const ACTIONS: Record<number, { desc: string; pts: number; emoji: string }[]> = {
  1: [
    { desc: "Take a sip of your drink", pts: 50, emoji: "🥤" },
    { desc: "Say something nice to the person on your left", pts: 100, emoji: "💬" },
    { desc: "Do 5 jumping jacks right now", pts: 150, emoji: "🏃" },
    { desc: "Tell the group one embarrassing thing you did this week", pts: 100, emoji: "😬" },
    { desc: "High-five everyone in the group", pts: 75, emoji: "🙌" },
  ],
  2: [
    { desc: "Tell your funniest joke — others rate it", pts: 150, emoji: "😂" },
    { desc: "Imitate someone in this group", pts: 200, emoji: "🎭" },
    { desc: "Give a dramatic speech about your favorite food", pts: 100, emoji: "🎤" },
    { desc: "Do your best celebrity impression", pts: 200, emoji: "🌟" },
    { desc: "Narrate what's happening right now like a nature documentary", pts: 175, emoji: "🎬" },
  ],
  3: [
    { desc: "Spin in place 3 times then try to walk straight", pts: 200, emoji: "🌀" },
    { desc: "Say the alphabet backwards as fast as you can", pts: 250, emoji: "🔤" },
    { desc: "Do your best dance move for 10 seconds", pts: 150, emoji: "🕺" },
    { desc: "Walk across the room balancing an imaginary book on your head", pts: 175, emoji: "📖" },
    { desc: "Do a 10-second air guitar solo", pts: 150, emoji: "🎸" },
  ],
  4: [
    { desc: "Everyone takes a group selfie — you get to pose", pts: 200, emoji: "📸" },
    { desc: "Whisper something you've never told the group", pts: 300, emoji: "🤫" },
    { desc: "Rate every person in the room's vibe out of 10", pts: 200, emoji: "📊" },
    { desc: "Describe your ideal version of the person to your right in 3 words", pts: 250, emoji: "🎭" },
    { desc: "Give someone in the group a completely made-up award and explain why", pts: 225, emoji: "🏆" },
  ],
  5: [
    { desc: "You control the music for the next 2 minutes!", pts: 400, emoji: "🎵" },
    { desc: "Everyone has to compliment you for 30 seconds", pts: 350, emoji: "👑" },
    { desc: "Invent a new word and use it in a sentence", pts: 300, emoji: "📚" },
    { desc: "Pick someone to swap seats with you for the next round", pts: 325, emoji: "🔀" },
    { desc: "Give the group a 30-second pep talk before the next challenge", pts: 300, emoji: "📣" },
  ],
  6: [
    { desc: "Make a toast to the group — be heartfelt", pts: 500, emoji: "🥂" },
    { desc: "You pick someone to do a dare of your choosing", pts: 450, emoji: "🎯" },
    { desc: "Freestyle rap for 15 seconds — any topic", pts: 400, emoji: "🎤" },
    { desc: "Invent a group handshake and teach it to everyone right now", pts: 475, emoji: "🤝" },
    { desc: "Make a house rule that everyone must follow for the next 3 rounds", pts: 500, emoji: "📜" },
  ],
};

const KEY = (roomId: string) => `experience:party_dice:${roomId}`;

export class PartyDiceExperience implements ExperienceModule {
  readonly type = "party_dice" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: PartyDiceState = {
      phase: "waiting", round: 0, totalRounds: 6,
      scores: {}, currentRoller: null, diceValue: null, currentAction: null, rollerOrder: [],
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
    const state: PartyDiceState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const guestIds = (payload as any).guestIds as string[] ?? [];
        state.rollerOrder = [...guestIds];
        state.totalRounds = Math.max(6, guestIds.length);
        state.round = 1;
        state.currentRoller = guestIds[0] ?? null;
        state.phase = "rolling";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "party_dice", state,
          view: { type: "party_dice" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "roll": {
        if (guestId !== state.currentRoller && role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "rolling") return;
        const val = Math.floor(Math.random() * 6) + 1;
        const acts = ACTIONS[val];
        const chosen = acts[Math.floor(Math.random() * acts.length)];
        state.diceValue = val;
        state.currentAction = chosen;
        state.phase = "action";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "party_dice", state,
          view: { type: "party_dice" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "complete": {
        if (state.phase !== "action") return;
        if (guestId !== state.currentRoller && role !== "HOST" && role !== "CO_HOST") return;
        if (state.currentRoller && state.currentAction) {
          state.scores[state.currentRoller] = (state.scores[state.currentRoller] ?? 0) + state.currentAction.pts;
        }
        await this._advanceRound(state, roomId, io);
        break;
      }
      case "skip": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._advanceRound(state, roomId, io);
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

  private async _advanceRound(state: PartyDiceState, roomId: string, io: Server): Promise<void> {
    state.round += 1;
    if (state.round > state.totalRounds) {
      state.phase = "finished";
      await redisClient.set(KEY(roomId), JSON.stringify(state));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "party_dice", state,
        view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
      });
    } else {
      const nextIdx = (state.round - 1) % state.rollerOrder.length;
      state.currentRoller = state.rollerOrder[nextIdx];
      state.diceValue = null;
      state.currentAction = null;
      state.phase = "rolling";
      await redisClient.set(KEY(roomId), JSON.stringify(state));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "party_dice", state,
        view: { type: "party_dice" as any, data: state }, sequenceId: seq,
      });
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: PartyDiceState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "party_dice" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }
}