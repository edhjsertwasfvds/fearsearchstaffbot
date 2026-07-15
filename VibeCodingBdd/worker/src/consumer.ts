import { DbClient, Env as DbEnv } from "./db";
import { FearClient, ProtectionError } from "./fearClient";
import { applyGlobalRateLimit } from "./rateLimiter";
import { shouldStopPagination } from "./syncService";
import { QueueJobPayload } from "./types";

export interface Env extends DbEnv {
  WORKER_SHARD?: string;
  WORKERS_TOTAL?: string;
  FEAR_PAGE_LIMIT?: string;
}

const DEFAULT_PAGE_LIMIT = 10;

export async function processQueueBatch(batch: MessageBatch<QueueJobPayload>, env: Env): Promise<void> {
  const db = new DbClient(env);
  const workerShard = Number(env.WORKER_SHARD ?? "-1");
  const workersTotal = Number(env.WORKERS_TOTAL ?? "20");
  const fearLimit = Number(env.FEAR_PAGE_LIMIT ?? String(DEFAULT_PAGE_LIMIT));

  const fearClient = new FearClient({
    timeoutMs: 10_000,
    maxRetries: 2,
    minJitterMs: 300,
    maxJitterMs: 1500,
    userAgent: "PunishmentsIngest/1.0",
  });

  for (const message of batch.messages) {
    const payload = message.body;
    if (workerShard >= 0 && payload.shard !== workerShard) {
      message.retry();
      continue;
    }

    try {
      await db.markJobRunning(payload.jobId, `worker-${workerShard >= 0 ? workerShard : "any"}`);
      await applyGlobalRateLimit(db, payload.type, workersTotal, Math.max(0, workerShard));

      const state = await db.getSyncState(payload.type);
      const response = await fearClient.fetchPunishmentsPage(payload.type, payload.page, fearLimit);
      const rows = response.punishments;

      const upserted = await db.upsertPunishments(payload.type, rows);
      const createdValues = rows.map((item) => item.created);
      const newestCreated = createdValues.length > 0 ? Math.max(...createdValues) : 0;
      const oldestCreated = createdValues.length > 0 ? Math.min(...createdValues) : Number.MAX_SAFE_INTEGER;
      await db.updateAfterPage(payload.type, payload.page, newestCreated);
      await db.recordMetrics("consumer.rows_upserted", upserted, {
        type: String(payload.type),
        page: String(payload.page),
      });

      if (shouldStopPagination(oldestCreated, state.last_seen_created)) {
        await db.updateAfterPage(payload.type, 1, newestCreated);
      }

      message.ack();
      await db.markJobDone(payload.jobId);
    } catch (error) {
      if (error instanceof ProtectionError) {
        await db.updateCooldown(payload.type, 900);
        await db.recordMetrics("consumer.protection_hit", 1, {
          type: String(payload.type),
          status: String(error.status),
        });
      }
      await db.markJobFailed(payload.jobId, String(error));
      message.retry();
    }
  }
}
