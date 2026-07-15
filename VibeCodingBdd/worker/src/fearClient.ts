import { PunishmentType, PunishmentsResponse } from "./types";

const BASE_URL = "https://api.fearproject.ru/punishments";

export class ProtectionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ProtectionError";
  }
}

export class UpstreamError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "UpstreamError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface FearClientOptions {
  timeoutMs: number;
  maxRetries: number;
  minJitterMs: number;
  maxJitterMs: number;
  userAgent: string;
}

export class FearClient {
  constructor(private readonly options: FearClientOptions) {}

  async fetchPunishmentsPage(type: PunishmentType, page: number, limit: number): Promise<PunishmentsResponse> {
    const url = new URL(BASE_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("type", String(type));

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      const jitter = randomInt(this.options.minJitterMs, this.options.maxJitterMs);
      await sleep(jitter);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("timeout"), this.options.timeoutMs);
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": this.options.userAgent,
          },
          signal: controller.signal,
        });

        if (response.status === 403 || response.status === 429) {
          throw new ProtectionError(`Protection triggered with status ${response.status}`, response.status);
        }

        if (!response.ok) {
          if (response.status >= 500 && attempt < this.options.maxRetries) {
            await sleep(backoffMs(attempt));
            continue;
          }
          throw new UpstreamError(`Upstream returned status ${response.status}`, response.status);
        }

        return (await response.json()) as PunishmentsResponse;
      } catch (error) {
        const retriable = error instanceof DOMException || error instanceof TypeError;
        if (retriable && attempt < this.options.maxRetries) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error("Failed to fetch after retries");
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function backoffMs(attempt: number): number {
  return Math.min(4000, 300 * 2 ** attempt + randomInt(50, 300));
}
