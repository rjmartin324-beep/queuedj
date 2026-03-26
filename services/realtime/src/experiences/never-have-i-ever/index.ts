import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Never Have I Ever Experience
//
// Each round reveals a prompt. Guests tap "I have" or "I never have".
// "Never" responses get +100 pts (staying pure). "Have" responses are
// shamefully displayed to the room.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: respond
// ─────────────────────────────────────────────────────────────────────────────

const PROMPTS: string[] = [
  "Never have I ever fallen asleep at a party",
  "Never have I ever pretended to know a song and sang the wrong lyrics",
  "Never have I ever lied about my age",
  "Never have I ever stayed up until sunrise just to keep the party going",
  "Never have I ever called the wrong person by the wrong name on a date",
  "Never have I ever cheated at a board game",
  "Never have I ever eaten an entire pizza by myself",
  "Never have I ever sent a text to the wrong person",
  "Never have I ever danced on a table",
  "Never have I ever crashed a party I wasn't invited to",
  // ── Added prompts to reach 60 total ────────────────────────────────────────
  "Never have I ever ghosted someone and then ran into them in public",
  "Never have I ever drunk-texted my ex",
  "Never have I ever cried at a commercial",
  "Never have I ever faked being sick to skip work or school",
  "Never have I ever eaten food that fell on the floor and said nothing",
  "Never have I ever stalked someone's Instagram all the way back to 2012",
  "Never have I ever pretended not to see someone I know in public",
  "Never have I ever taken a selfie in a bathroom at a party",
  "Never have I ever lied about having seen a movie everyone was talking about",
  "Never have I ever used someone else's Netflix password",
  "Never have I ever ordered food and eaten it before getting home",
  "Never have I ever fallen asleep during a movie at the cinema",
  "Never have I ever re-gifted a present I received",
  "Never have I ever accidentally liked someone's old post while stalking their profile",
  "Never have I ever had a full conversation while sleepwalking",
  "Never have I ever spent more than $100 on a single meal",
  "Never have I ever lied on my resume or job application",
  "Never have I ever bought something expensive and hidden it from my partner",
  "Never have I ever sung in the shower and pretended I was performing at a concert",
  "Never have I ever binge-watched an entire season in one sitting",
  "Never have I ever argued with a stranger on the internet",
  "Never have I ever missed a flight",
  "Never have I ever cried on a plane",
  "Never have I ever been kicked out of a place",
  "Never have I ever tried to impress someone by pretending to like their favourite band",
  "Never have I ever cheated on a test",
  "Never have I ever driven through a red light on purpose",
  "Never have I ever pretended my phone was ringing to escape an awkward situation",
  "Never have I ever read someone else's diary or private messages",
  "Never have I ever worn the same outfit two days in a row and pretended I changed",
  "Never have I ever taken food from a coworker's lunch in the fridge",
  "Never have I ever cried in a public restroom",
  "Never have I ever set an alarm and turned it off in my sleep without waking up",
  "Never have I ever broken something in someone's house and not told them",
  "Never have I ever pretended to understand an accent and nodded along",
  "Never have I ever made a wish at 11:11",
  "Never have I ever gone on a trip solo",
  "Never have I ever deleted a social media post because it got no likes",
  "Never have I ever said 'I'll call you back' and never called back",
  "Never have I ever ordered something online and returned it after wearing it once",
  "Never have I ever walked into a glass door",
  "Never have I ever eavesdropped on a conversation at a restaurant",
  "Never have I ever bought something just because a celebrity endorsed it",
  "Never have I ever mispronounced a word in front of a crowd and played it off",
  "Never have I ever fallen asleep on public transportation and missed my stop",
  "Never have I ever pretended to be busy when someone texted me",
  "Never have I ever skipped a wedding or big event for a flimsy excuse",
  "Never have I ever laughed so hard I cried in an inappropriate situation",
  "Never have I ever asked Siri or Alexa something deeply personal",
  "Never have I ever panic-cleaned my home when guests said they were coming over",
];

interface NeverHaveIEverState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPrompt: string | null;
  responses: Record<string, "have" | "never">;
  haveCount: number;
  neverCount: number;
}

const KEY = (roomId: string) => `experience:never_have_i_ever:${roomId}`;

export class NeverHaveIEverExperience implements ExperienceModule {
  readonly type = "never_have_i_ever" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: NeverHaveIEverState = {
      phase: "waiting",
      round: 0,
      totalRounds: PROMPTS.length,
      scores: {},
      currentPrompt: null,
      responses: {},
      haveCount: 0,
      neverCount: 0,
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
    const state: NeverHaveIEverState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "question";
        state.round = 1;
        state.currentPrompt = PROMPTS[0];
        state.responses = {};
        state.haveCount = 0;
        state.neverCount = 0;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "never_have_i_ever",
          state: { ...state, responses: {} },
          view: { type: "never_have_i_ever", data: { ...state, responses: {} } },
          sequenceId: seq,
        });
        break;
      }

      case "respond": {
        if (state.phase !== "question") return;
        const p = payload as { choice: "have" | "never" };
        if (!p?.choice || (p.choice !== "have" && p.choice !== "never")) return;
        const prev = state.responses[guestId];
        if (prev === "have") state.haveCount = Math.max(0, state.haveCount - 1);
        if (prev === "never") state.neverCount = Math.max(0, state.neverCount - 1);
        state.responses[guestId] = p.choice;
        if (p.choice === "have") state.haveCount++;
        else state.neverCount++;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        // Broadcast counts only — hide who responded what until reveal
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "never_have_i_ever",
          state: { ...state, responses: {} },
          view: { type: "never_have_i_ever", data: { ...state, responses: {} } },
          sequenceId: seq,
        });
        break;
      }

      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "question") return;
        // Award +100 to guests who answered "never" (stayed pure)
        for (const [voter, choice] of Object.entries(state.responses)) {
          if (choice === "never") {
            state.scores[voter] = (state.scores[voter] ?? 0) + 100;
          }
        }
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "never_have_i_ever",
          state,
          view: { type: "never_have_i_ever", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentPrompt = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "never_have_i_ever",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          state.phase = "question";
          state.currentPrompt = PROMPTS[(state.round - 1) % PROMPTS.length];
          state.responses = {};
          state.haveCount = 0;
          state.neverCount = 0;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "never_have_i_ever",
            state: { ...state, responses: {} },
            view: { type: "never_have_i_ever", data: { ...state, responses: {} } },
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
    const state: NeverHaveIEverState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    // Never expose individual responses to guests outside of reveal phase
    if (state.phase !== "reveal") {
      return { type: "never_have_i_ever" as any, data: { ...state, responses: {} } };
    }
    return { type: "never_have_i_ever" as any, data: state };
  }
}
