import { DbClient } from "./db";
import { PunishmentType } from "./types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function applyGlobalRateLimit(
  db: DbClient,
  type: PunishmentType,
  workersTotal: number,
  currentWorkerIndex: number,
): Promise<void> {
  const state = await db.getSyncState(type);
  const targetRps = Math.max(1, state.target_rps || 3);
  const activeWorkers = Math.max(1, Math.min(workersTotal, state.active_workers || workersTotal));
  const baseDelayMs = Math.ceil((1000 / targetRps) * activeWorkers);
  const phaseOffset = Math.floor((baseDelayMs / activeWorkers) * currentWorkerIndex);
  const jitter = Math.floor(Math.random() * 250);
  await sleep(baseDelayMs + phaseOffset + jitter);
}

export function scaleWorkersByProtectionHits(currentWorkers: number, protectionRate: number): number {
  if (protectionRate >= 0.2) {
    return 2;
  }
  if (protectionRate >= 0.1) {
    return 5;
  }
  if (protectionRate >= 0.05) {
    return 10;
  }
  return Math.max(10, currentWorkers);
}
