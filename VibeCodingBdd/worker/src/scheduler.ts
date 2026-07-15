import { DbClient, Env as DbEnv } from "./db";
import { buildJobsForTick } from "./syncService";
import { scaleWorkersByProtectionHits } from "./rateLimiter";

export interface Env extends DbEnv {
  PUNISHMENTS_QUEUE: Queue<unknown>;
  PAGES_PER_TICK?: string;
  ACTIVE_WORKERS?: string;
  COOLDOWN_SECONDS?: string;
}

export async function runScheduler(env: Env): Promise<Response> {
  const db = new DbClient(env);
  const pagesPerTick = Number(env.PAGES_PER_TICK ?? "8");
  const activeWorkers = Number(env.ACTIVE_WORKERS ?? "20");
  const cooldownSeconds = Number(env.COOLDOWN_SECONDS ?? "900");

  const jobs = await buildJobsForTick(db, {
    pagesPerTick,
    activeWorkers,
    cooldownSeconds,
  });

  for (const job of jobs) {
    await env.PUNISHMENTS_QUEUE.send(job);
  }

  await db.recordMetrics("scheduler.jobs_created", jobs.length, { source: "cron" });
  return Response.json({
    ok: true,
    jobsCreated: jobs.length,
    pagesPerTick,
  });
}

export async function reconcileWorkersByHealth(env: Env): Promise<void> {
  const db = new DbClient(env);
  const protectionHits = 0;
  const requests = 1;
  const rate = protectionHits / requests;
  const nextWorkers = scaleWorkersByProtectionHits(Number(env.ACTIVE_WORKERS ?? "20"), rate);
  await db.setRuntimeControls(1, nextWorkers, 4);
  await db.setRuntimeControls(2, nextWorkers, 4);
}
