import { neon } from "@neondatabase/serverless";
import { Punishment, PunishmentType, QueueJobPayload, SyncStateRow } from "./types";

export interface Env {
  DATABASE_URL: string;
}

export class DbClient {
  private readonly sql;

  constructor(env: Env) {
    this.sql = neon(env.DATABASE_URL);
  }

  async ensureStateRows(): Promise<void> {
    await this.sql`
      insert into sync_state(type, last_seen_created)
      values (1, 0), (2, 0)
      on conflict (type) do nothing
    `;
  }

  async getSyncState(type: PunishmentType): Promise<SyncStateRow> {
    const [row] = await this.sql`
      select
        type,
        last_seen_created,
        next_page_hint,
        cooldown_until,
        target_rps,
        active_workers,
        pages_per_tick
      from sync_state
      where type = ${type}
      limit 1
    `;
    return row as SyncStateRow;
  }

  async createJob(payload: QueueJobPayload): Promise<boolean> {
    const result = await this.sql`
      insert into sync_jobs(job_id, type, page, shard, status, attempts)
      values (${payload.jobId}, ${payload.type}, ${payload.page}, ${payload.shard}, 'queued', 0)
      on conflict (job_id) do nothing
      returning job_id
    `;
    return result.length > 0;
  }

  async markJobRunning(jobId: string, lockedBy: string): Promise<void> {
    await this.sql`
      update sync_jobs
      set
        status = 'running',
        attempts = attempts + 1,
        locked_by = ${lockedBy},
        lock_expires_at = now() + interval '2 minutes',
        updated_at = now()
      where job_id = ${jobId}
    `;
  }

  async markJobDone(jobId: string): Promise<void> {
    await this.sql`
      update sync_jobs
      set
        status = 'done',
        lock_expires_at = null,
        updated_at = now()
      where job_id = ${jobId}
    `;
  }

  async markJobFailed(jobId: string, errorText: string): Promise<void> {
    await this.sql`
      update sync_jobs
      set
        status = 'failed',
        last_error = ${errorText.slice(0, 600)},
        lock_expires_at = null,
        updated_at = now()
      where job_id = ${jobId}
    `;
  }

  async updateCooldown(type: PunishmentType, cooldownSeconds: number): Promise<void> {
    await this.sql`
      update sync_state
      set cooldown_until = now() + (${cooldownSeconds} * interval '1 second')
      where type = ${type}
    `;
  }

  async clearCooldown(type: PunishmentType): Promise<void> {
    await this.sql`
      update sync_state
      set cooldown_until = null
      where type = ${type}
    `;
  }

  async updateAfterPage(type: PunishmentType, page: number, newestCreated: number): Promise<void> {
    await this.sql`
      update sync_state
      set
        next_page_hint = greatest(1, ${page} + 1),
        last_seen_created = greatest(last_seen_created, ${newestCreated}),
        updated_at = now()
      where type = ${type}
    `;
  }

  async setRuntimeControls(type: PunishmentType, activeWorkers: number, targetRps: number): Promise<void> {
    await this.sql`
      update sync_state
      set
        active_workers = ${activeWorkers},
        target_rps = ${targetRps},
        updated_at = now()
      where type = ${type}
    `;
  }

  async recordMetrics(metric: string, value: number, tags: Record<string, string>): Promise<void> {
    await this.sql`
      insert into sync_metrics(metric, value, tags)
      values (${metric}, ${value}, ${JSON.stringify(tags)})
    `;
  }

  async upsertPunishments(type: PunishmentType, rows: Punishment[]): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    let upserted = 0;
    for (const row of rows) {
      await this.sql`
        insert into punishments(
          id, type, steamid, name, admin, admin_steamid, admin_avatar, avatar,
          reason, status, duration, created, expires, unban_price, raw_json, updated_at
        )
        values (
          ${row.id}, ${type}, ${row.steamid}, ${row.name}, ${row.admin}, ${row.admin_steamid},
          ${row.admin_avatar}, ${row.avatar}, ${row.reason}, ${row.status}, ${row.duration},
          ${row.created}, ${row.expires}, ${row.unbanPrice}, ${JSON.stringify(row)}, now()
        )
        on conflict (id)
        do update set
          type = excluded.type,
          steamid = excluded.steamid,
          name = excluded.name,
          admin = excluded.admin,
          admin_steamid = excluded.admin_steamid,
          admin_avatar = excluded.admin_avatar,
          avatar = excluded.avatar,
          reason = excluded.reason,
          status = excluded.status,
          duration = excluded.duration,
          created = excluded.created,
          expires = excluded.expires,
          unban_price = excluded.unban_price,
          raw_json = excluded.raw_json,
          updated_at = now()
      `;
      upserted++;
    }
    return upserted;
  }
}
