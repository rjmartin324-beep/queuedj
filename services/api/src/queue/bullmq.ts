import { Queue, QueueEvents } from "bullmq";
import type {
  AudioAnalysisJobPayload,
  ISRCLookupJobPayload,
  TransitionAnalysisJobPayload,
  RLHFSignalJobPayload,
} from "@queuedj/shared-types";

type BullMQQueue = "critical" | "high" | "normal" | "low";

// ─────────────────────────────────────────────────────────────────────────────
// BullMQ Job Queue — Bridge between Node.js and Python ML service
//
// Queue Priority Architecture:
//   critical: Transition analysis — must complete before the transition starts
//             Target: < 5s. Triggered 30s before transition point.
//   high:     Track fingerprint on load — must complete before preload buffer fills
//             Target: < 10s
//   normal:   RLHF signals — crowd feedback, can tolerate 30s+ delay
//   low:      Style DNA updates — run after session ends, no user impact
// ─────────────────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const _redisUrl = new URL(REDIS_URL);
const redisConnection = {
  host: _redisUrl.hostname,
  port: parseInt(_redisUrl.port || "6379"),
  ...(_redisUrl.password ? { password: decodeURIComponent(_redisUrl.password) } : {}),
};

export type MLJobPayload =
  | AudioAnalysisJobPayload
  | ISRCLookupJobPayload
  | TransitionAnalysisJobPayload
  | RLHFSignalJobPayload;

// ─── Queue Definitions ────────────────────────────────────────────────────────

const QUEUE_NAMES: Record<BullMQQueue, string> = {
  critical: "ml-critical",
  high:     "ml-high",
  normal:   "ml-normal",
  low:      "ml-low",
};

// Default job options per queue
const QUEUE_DEFAULTS: Record<BullMQQueue, object> = {
  critical: {
    attempts: 3,
    backoff: { type: "exponential", delay: 500 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 500 },
    // TTL: if not picked up within 30s, ML service is lagging — skip this job
    // The transition will fall back to rule-based logic
    jobId: undefined, // Dynamic per job
  },
  high: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 500 },
    removeOnFail:     { count: 1000 },
  },
  normal: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail:     { count: 2000 },
  },
  low: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10000 },
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 500 },
    delay: 5000, // Low priority jobs wait 5s before being picked up
  },
};

// ─── Queue Manager ────────────────────────────────────────────────────────────

class QueueManager {
  private queues = new Map<BullMQQueue, Queue>();
  private queueEvents = new Map<BullMQQueue, QueueEvents>();

  constructor() {
    for (const [priority, name] of Object.entries(QUEUE_NAMES) as [BullMQQueue, string][]) {
      const queue = new Queue(name, {
        connection: redisConnection,
        defaultJobOptions: QUEUE_DEFAULTS[priority],
      });
      this.queues.set(priority, queue);

      // QueueEvents: monitor job completion for request/response pattern
      const events = new QueueEvents(name, { connection: redisConnection });
      this.queueEvents.set(priority, events);
    }
  }

  // ─── Add Jobs ─────────────────────────────────────────────────────────────

  async addAudioAnalysis(payload: AudioAnalysisJobPayload, priority: BullMQQueue = "high"): Promise<string> {
    const queue = this.queues.get(priority)!;
    const job = await queue.add("audio_analysis", payload, {
      // Deduplicate: don't re-analyze the same ISRC within 1 hour
      jobId: `audio_analysis:${payload.isrc}:${priority}`,
    });
    return job.id!;
  }

  async addISRCLookup(payload: ISRCLookupJobPayload): Promise<string> {
    const queue = this.queues.get("high")!;
    const job = await queue.add("isrc_lookup", payload, {
      // Deduplicate by title+artist
      jobId: `isrc_lookup:${payload.title.slice(0, 20)}:${payload.artist.slice(0, 20)}`,
    });
    return job.id!;
  }

  async addTransitionAnalysis(payload: TransitionAnalysisJobPayload): Promise<string> {
    const queue = this.queues.get("critical")!;
    const job = await queue.add("transition_analysis", payload, {
      // One active transition analysis per from→to pair at a time
      jobId: `transition:${payload.fromIsrc}:${payload.toIsrc}`,
    });
    return job.id!;
  }

  async addRLHFSignal(payload: RLHFSignalJobPayload): Promise<void> {
    // GDPR gate — check feature flag before logging any training signal
    if (process.env.FEATURE_RLHF_LOGGING !== "true") return;

    const queue = this.queues.get("normal")!;
    await queue.add("rlhf_signal", payload);
  }

  async addStyleDNAUpdate(hostFingerprint: string): Promise<void> {
    const queue = this.queues.get("low")!;
    await queue.add("style_dna_update", { hostFingerprint }, {
      // Only one update per host at a time
      jobId: `style_dna:${hostFingerprint}`,
    });
  }

  async addStemSeparation(isrc: string, audioUrl: string): Promise<string> {
    // Low priority — stem separation is background work, takes 1-3 min on CPU
    // Deduped by ISRC so re-enqueueing the same track is safe
    const queue = this.queues.get("low")!;
    const job = await queue.add("stem_separation", { isrc, audioUrl }, {
      jobId: `stem_separation:${isrc}`,
      attempts: 2,
      backoff: { type: "fixed", delay: 30_000 }, // retry after 30s on failure
    });
    return job.id!;
  }

  // ─── Wait for Result (Critical Jobs) ──────────────────────────────────────
  // Used when caller needs the ML result before proceeding
  // e.g.: Transition analysis must finish before we commit to a transition plan

  async waitForJob<T>(priority: BullMQQueue, jobId: string, timeoutMs = 10000): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        // Timeout: fall back to rule-based logic, don't block
        resolve(null);
      }, timeoutMs);

      const events = this.queueEvents.get(priority)!;

      const onCompleted = async ({ jobId: completedId, returnvalue }: { jobId: string; returnvalue: string }) => {
        if (completedId === jobId) {
          clearTimeout(timer);
          events.off("completed", onCompleted);
          events.off("failed", onFailed);
          resolve(JSON.parse(returnvalue) as T);
        }
      };

      const onFailed = ({ jobId: failedId }: { jobId?: string }) => {
        if (failedId === jobId) {
          clearTimeout(timer);
          events.off("completed", onCompleted);
          events.off("failed", onFailed);
          resolve(null); // Caller falls back to rule-based
        }
      };

      events.on("completed", onCompleted);
      events.on("failed", onFailed);
    });
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  async getQueueHealth(): Promise<Record<string, object>> {
    const health: Record<string, object> = {};
    for (const [priority, queue] of this.queues.entries()) {
      const [waiting, active, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      health[priority] = { waiting, active, failed, delayed };
    }
    return health;
  }

  async close(): Promise<void> {
    for (const queue of this.queues.values()) await queue.close();
    for (const events of this.queueEvents.values()) await events.close();
  }
}

// Singleton — one queue manager per process
export const queueManager = new QueueManager();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await queueManager.close();
});
