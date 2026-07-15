export type PunishmentType = 1 | 2;

export interface Punishment {
  id: number;
  steamid: string;
  name: string;
  admin: string;
  admin_steamid: string;
  admin_avatar: string | null;
  avatar: string | null;
  reason: string;
  status: number;
  duration: number;
  created: number;
  expires: number;
  unbanPrice: number | null;
}

export interface PunishmentsResponse {
  total: string;
  page: number;
  limit: number;
  punishments: Punishment[];
}

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface SyncJob {
  job_id: string;
  type: PunishmentType;
  page: number;
  shard: number;
  status: JobStatus;
  attempts: number;
}

export interface QueueJobPayload {
  jobId: string;
  type: PunishmentType;
  page: number;
  shard: number;
  scheduledAt: number;
}

export interface SyncStateRow {
  type: PunishmentType;
  last_seen_created: number;
  next_page_hint: number;
  cooldown_until: number | null;
  target_rps: number;
  active_workers: number;
  pages_per_tick: number;
}
