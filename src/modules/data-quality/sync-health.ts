import { connectMongo } from "@/lib/database/mongoose";
import { GarminConnection, SyncLog } from "@/models";

function durationMs(startedAt?: Date, completedAt?: Date | null) {
  if (!startedAt || !completedAt) return null;
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function friendlyError(code?: string | null, message?: string | null) {
  if (!code && !message) return null;
  const map: Record<string, string> = {
    GARMIN_AUTH_INVALID: "Garmin authentication failed. Re-check your API key.",
    GARMIN_AUTH_EXPIRED: "Garmin session expired. Try sync again.",
    GARMIN_RATE_LIMITED: "Garmin rate-limited the request. Wait and retry.",
    SYNC_LOCKED: "Another sync of this type is already running.",
    GARMIN_API_PENDING: "Garmin API was not ready yet. Retry sync.",
    GARMIN_API_ERROR: "Garmin returned an API error.",
  };
  return map[code ?? ""] ?? message ?? code ?? "Sync failed.";
}

async function latestOf(type: "activities" | "health") {
  const [lastAttempt, lastSuccess, running] = await Promise.all([
    SyncLog.findOne({ type }).sort({ startedAt: -1 }).lean(),
    SyncLog.findOne({ type, status: "success" }).sort({ completedAt: -1 }).lean(),
    SyncLog.findOne({ type, status: "running" }).sort({ startedAt: -1 }).lean(),
  ]);
  return { lastAttempt, lastSuccess, running };
}

export async function getSyncHealth() {
  await connectMongo();
  const conn = await GarminConnection.findOne().lean();
  const [activities, health] = await Promise.all([
    latestOf("activities"),
    latestOf("health"),
  ]);

  const mapSide = (
    type: "activities" | "health",
    side: Awaited<ReturnType<typeof latestOf>>,
    connStamp: Date | null | undefined
  ) => {
    const attempt = side.lastAttempt;
    const success = side.lastSuccess;
    const status = side.running
      ? "running"
      : attempt?.status === "failed"
        ? "failed"
        : attempt?.status === "success" &&
            (attempt.recordsFetched ?? 0) === 0 &&
            type === "health"
          ? "partial"
          : attempt?.status ?? (connStamp ? "success" : "not_synced");

    return {
      type,
      status,
      lastSuccessfulAt:
        success?.completedAt?.toISOString() ??
        connStamp?.toISOString() ??
        null,
      lastAttemptAt: attempt?.startedAt?.toISOString() ?? null,
      lastResult: attempt?.status ?? null,
      durationMs: durationMs(attempt?.startedAt, attempt?.completedAt),
      recordsFetched: attempt?.recordsFetched ?? 0,
      recordsCreated: attempt?.recordsCreated ?? 0,
      recordsUpdated: attempt?.recordsUpdated ?? 0,
      errorCode: attempt?.errorCode ?? null,
      errorMessage: friendlyError(
        attempt?.errorCode,
        attempt?.sanitizedErrorMessage
      ),
    };
  };

  return {
    connectionStatus: conn?.status ?? "disconnected",
    lastSuccessfulSyncAt: conn?.lastSuccessfulSyncAt?.toISOString() ?? null,
    activities: mapSide(
      "activities",
      activities,
      conn?.lastActivitySyncAt ?? conn?.lastSuccessfulSyncAt
    ),
    health: mapSide(
      "health",
      health,
      conn?.lastHealthSyncAt ?? null
    ),
    evaluatedAt: new Date().toISOString(),
  };
}
