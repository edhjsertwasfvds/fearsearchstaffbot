import { processQueueBatch, Env as ConsumerEnv } from "./consumer";
import { reconcileWorkersByHealth, runScheduler, Env as SchedulerEnv } from "./scheduler";

type Env = ConsumerEnv & SchedulerEnv;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "punishments-ingest" });
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      return runScheduler(env);
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await runScheduler(env);
    await reconcileWorkersByHealth(env);
  },

  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    await processQueueBatch(batch as MessageBatch<any>, env);
  },
};
