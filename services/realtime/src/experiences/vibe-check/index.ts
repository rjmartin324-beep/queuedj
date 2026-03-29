import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";

// ─────────────────────────────────────────────────────────────────────────────
// Vibe Check Experience
//
// Live rating of the current track. Guests slide 1–10.
// Results shown as a live average + distribution bar.
// Low vibe triggers a "Skip this?" prompt to the host.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:vibe_check:${roomId}`;

// Pre-built scenarios for host to cycle through (rate 1–10)
const SCENARIOS: string[] = [
  "Sleeping with socks on",
  "Texting your ex at 2am",
  "Skipping the gym for three weeks straight",
  "Replying 'you too' when the waiter says enjoy your meal",
  "Eating cereal with water because there's no milk",
  "Liking your own Instagram posts",
  "Sending a voice note longer than two minutes",
  "Bringing a salad to a barbecue",
  "Telling someone their baby is ugly (in your head)",
  "Fake-laughing at a joke you didn't hear",
  "Cancelling plans you were excited about an hour ago",
  "Reheating fish in the office microwave",
  "Sending a 'k' as a reply",
  "Taking the last slice without asking",
  "Accepting a LinkedIn request from your boss's boss",
  "Watching someone's full story on Instagram without reacting",
  "Going to bed at 9pm on a Saturday",
  "Muting the group chat but not leaving it",
  "Using speakerphone in public",
  "Recalling a conversation from years ago at 3am and cringing",
  "Pretending your phone died to avoid a call",
  "Ordering the most expensive thing at a group dinner",
  "Wearing shoes inside at someone else's house",
  "Giving a one-star review for a minor inconvenience",
  "Asking 'is everything okay?' when you know it isn't",
  "Refreshing your own Instagram reel views",
  "Double-texting after being left on read",
  "Wearing the same jeans for two weeks without washing them",
  "Replying to a message three days later with 'lol sorry just saw this'",
  "Skipping the queue because you 'only have one thing'",
  "Venting to a friend about someone they also know",
  "Eating a snack you bought for someone else",
  "Ghosting a conversation mid-sentence",
  "Saying 'I'm fine' when you are absolutely not fine",
  "Keeping notifications unread so they feel urgent",
  "Telling a story that includes 'you had to be there'",
  "Taking a work call from the bathroom",
  "Watching the same show for the fourth time instead of trying something new",
  "Showing up early to a party and immediately regretting it",
  "Setting seven alarms and still being late",
  "Saying you'll be there in five minutes when you haven't left yet",
  "Asking for 'just a taste' and taking a full bite",
  "Owning a book you've never read but keep on display",
  "Crying at a commercial",
  "Blocking someone and then checking their profile anyway",
  "Ordering delivery when the restaurant is walking distance",
  "Going through someone's old photos 'just quickly'",
  "Knowing all the words to a song you claim to hate",
  "Ending a call and immediately talking about the person you just hung up with",
  "Screenshotting a conversation to send to someone else",
];

interface VibeCheckState {
  phase: "rating" | "revealed";
  isrc: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  ratings: Record<string, number>;  // guestId → 1-10
  average: number;
  distribution: number[];           // index 0-9 = ratings 1-10
}

export class VibeCheckExperience implements ExperienceModule {
  readonly type = "vibe_check" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: VibeCheckState = {
      phase: "rating",
      isrc: null,
      trackTitle: null,
      trackArtist: null,
      ratings: {},
      average: 0,
      distribution: new Array(10).fill(0),
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {}

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      case "set_track":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._setTrack(roomId, p.isrc, p.title, p.artist, io);
        break;

      case "submit_rating":
        await this._submitRating(roomId, guestId, Math.min(10, Math.max(1, p.rating)), io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "reset":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this.onActivate(roomId);
        io.to(roomId).emit("experience:state_updated", { phase: "rating", ratings: {}, average: 0, distribution: new Array(10).fill(0) });
        break;

      case "pick_scenario":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._pickScenario(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    return {
      view: "vibe_check",
      data: {
        phase: state.phase,
        trackTitle: state.trackTitle,
        trackArtist: state.trackArtist,
        average: state.average,
        distribution: state.distribution,
        ratingCount: Object.keys(state.ratings).length,
      },
    };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _setTrack(roomId: string, isrc: string, title: string, artist: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.isrc = isrc;
    state.trackTitle = title;
    state.trackArtist = artist;
    state.ratings = {};
    state.average = 0;
    state.distribution = new Array(10).fill(0);
    state.phase = "rating";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", { phase: "rating", trackTitle: title, trackArtist: artist, average: 0, distribution: state.distribution, ratingCount: 0 });
  }

  private async _submitRating(roomId: string, guestId: string, rating: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "rating") return;

    // Remove old rating from distribution
    const old = state.ratings[guestId];
    if (old !== undefined) state.distribution[old - 1]--;

    state.ratings[guestId] = rating;
    state.distribution[rating - 1]++;

    const vals = Object.values(state.ratings);
    state.average = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

    await this._save(roomId, state);

    // Broadcast live update (no individual ratings revealed)
    io.to(roomId).emit("vibe_check:updated", {
      average: Math.round(state.average * 10) / 10,
      distribution: state.distribution,
      ratingCount: vals.length,
    });

    // Warn host if vibe is low
    if (state.average < 4 && vals.length >= 3) {
      io.to(roomId).emit("vibe_check:low_vibe_alert", { average: state.average });
    }
  }

  private async _pickScenario(roomId: string, io: Server): Promise<void> {
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    await this._setTrack(roomId, null as any, scenario, null as any, io);
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.phase = "revealed";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "revealed",
      average: Math.round(state.average * 10) / 10,
      distribution: state.distribution,
      ratingCount: Object.keys(state.ratings).length,
    });
  }

  private async _load(roomId: string): Promise<VibeCheckState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : { phase: "rating", isrc: null, trackTitle: null, trackArtist: null, ratings: {}, average: 0, distribution: new Array(10).fill(0) };
  }

  private async _save(roomId: string, state: VibeCheckState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}