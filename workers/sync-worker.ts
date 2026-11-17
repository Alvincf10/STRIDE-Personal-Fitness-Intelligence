/**
 * Scheduled Garmin sync worker.
 * Run: npm run worker:sync
 *
 * Pulls activities and health on intervals from env.
 * Lab/local only — uses the same Mongo + encrypted Garmin connection as the app.
 */

import { getEnv } from "../src/config/env";
import {
  runSyncBlocking,
} from "../src/modules/synchronization/service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick(
  type: "activities" | "health",
  label: string
): Promise<void> {
  const started = new Date().toISOString();
  try {
    const result = await runSyncBlocking(type);
    console.log(
      JSON.stringify({
        at: started,
        type,
        label,
        status: result.status,
        jobId: result.jobId,
        errorCode: result.errorCode ?? null,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        at: started,
        type,
        label,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

async function main() {
  const env = getEnv();
  const activityMs = env.SYNC_ACTIVITIES_INTERVAL_MINUTES * 60_000;
  const healthMs = env.SYNC_HEALTH_INTERVAL_MINUTES * 60_000;

  console.log(
    JSON.stringify({
      message: "STRIDE sync worker started",
      activityIntervalMinutes: env.SYNC_ACTIVITIES_INTERVAL_MINUTES,
      healthIntervalMinutes: env.SYNC_HEALTH_INTERVAL_MINUTES,
    })
  );

  // Immediate first pass, then interval loops.
  await tick("activities", "boot");
  await tick("health", "boot");

  let lastActivity = Date.now();
  let lastHealth = Date.now();

  for (;;) {
    const now = Date.now();
    if (now - lastActivity >= activityMs) {
      await tick("activities", "interval");
      lastActivity = Date.now();
    }
    if (now - lastHealth >= healthMs) {
      await tick("health", "interval");
      lastHealth = Date.now();
    }
    await sleep(15_000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
