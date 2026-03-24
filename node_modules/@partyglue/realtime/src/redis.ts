import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Two clients: one for commands, one for subscriptions
// (Redis pub/sub requires a dedicated connection)
export const redisClient = createClient({ url: REDIS_URL });
export const redisSub = redisClient.duplicate();

redisClient.on("error", (err) => console.error("[redis] client error", err));
redisSub.on("error",    (err) => console.error("[redis] sub error", err));

export async function connectRedis() {
  await Promise.all([redisClient.connect(), redisSub.connect()]);
  console.log("[redis] connected");
}
