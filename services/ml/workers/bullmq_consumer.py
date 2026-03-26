"""
BullMQ Consumer — polls Redis queues and dispatches jobs to workers.

BullMQ stores jobs in Redis under bull:{queue}:waiting / active / completed.
We poll with BLPOP for zero-latency pickup.
"""

import asyncio
import json
import structlog

log = structlog.get_logger()

QUEUE_NAMES = ["audio_analysis", "isrc_lookup", "transition_analysis", "rlhf_signal", "taste_graph"]


class BullMQConsumer:
    def __init__(self, redis_client, workers: dict):
        self.redis   = redis_client
        self.workers = workers
        self._running = False
        self._health: dict[str, int] = {q: 0 for q in QUEUE_NAMES}

    async def start(self):
        self._running = True
        log.info("bullmq_consumer_started", queues=list(self.workers.keys()))
        await asyncio.gather(*[self._consume(name) for name in self.workers])

    async def stop(self):
        self._running = False
        log.info("bullmq_consumer_stopped")

    async def get_health(self) -> dict:
        return self._health

    async def _consume(self, queue_name: str):
        waiting_key = f"bull:{queue_name}:waiting"
        worker = self.workers[queue_name]

        while self._running:
            try:
                result = await self.redis.blpop(waiting_key, timeout=2)
                if not result:
                    continue

                _, raw = result
                job = json.loads(raw)
                self._health[queue_name] = self._health.get(queue_name, 0) + 1

                try:
                    await worker.process_job(job.get("data", job))
                except Exception as e:
                    log.error("job_failed", queue=queue_name, error=str(e))

            except Exception as e:
                log.error("consumer_error", queue=queue_name, error=str(e))
                await asyncio.sleep(1)
