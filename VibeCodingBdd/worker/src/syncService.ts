import { DbClient } from "./db";
import { QueueJobPayload, PunishmentType } from "./types";

const TYPES: PunishmentType[] = [1, 2];
const SHARDS_TOTAL = 20;

export interface SchedulerConfig {
  pagesPerTick: number;
  activeWorkers: number;
  cooldownSeconds: number;
}

export async function buildJobsForTick(db: DbClient, config: SchedulerConfig): Promise<QueueJobPayload[]> {
  await db.ensureStateRows();
  const jobs: QueueJobPayload[] = [];
  const now = Date.now();

  for (const type of TYPES) {
    const state = await db.getSyncState(type);
    const inCooldown = state.cooldown_until ? new Date(state.cooldown_until).getTime() > now : false;
    if (inCooldown) {
      continue;
    }

    const firstPage = Math.max(1, state.next_page_hint || 1);
    const pagesPerTick = Math.max(1, state.pages_per_tick || config.pagesPerTick);
    for (let offset = 0; offset < pagesPerTick; offset++) {
      const page = firstPage + offset;
      const shard = page % SHARDS_TOTAL;
      const jobId = `${type}:${page}:${Math.floor(now / 60000)}`;
      const payload: QueueJobPayload = {
        jobId,
        type,
        page,
        shard,
        scheduledAt: now,
      };
      const created = await db.createJob(payload);
      if (created) {
        jobs.push(payload);
      }
    }
  }

  return jobs;
}

export function shouldStopPagination(oldestCreatedOnPage: number, lastSeenCreated: number): boolean {
  return oldestCreatedOnPage <= lastSeenCreated;
}
