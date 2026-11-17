import { connectMongo } from "@/lib/database/mongoose";
import { Activity, SyncLog } from "@/models";
import type { RoutePoint } from "@/modules/activities/route-geo";
import { upsertGarminActivity } from "@/modules/activities/service";
import { GarminAdapterError } from "@/modules/garmin/adapter";
import {
  createAuthenticatedAdapter,
  persistAdapterToken,
} from "@/modules/garmin/connection-service";

const locks = new Set<string>();

export async function queueSyncJob(type: "activities" | "health" | "reconciliation") {
  await connectMongo();
  const log = await SyncLog.create({
    type,
    status: "running",
    startedAt: new Date(),
    recordsFetched: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
  });

  void runSync(String(log._id), type);
  return { jobId: String(log._id), type, status: "running" as const };
}

/** Blocking sync for the dedicated worker process. */
export async function runSyncBlocking(
  type: "activities" | "health" | "reconciliation"
) {
  await connectMongo();
  const log = await SyncLog.create({
    type,
    status: "running",
    startedAt: new Date(),
    recordsFetched: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
  });
  await runSync(String(log._id), type);
  const done = await SyncLog.findById(log._id).lean();
  return {
    jobId: String(log._id),
    type,
    status: (done?.status ?? "failed") as "success" | "failed" | "running",
    errorCode: done?.errorCode ?? null,
    sanitizedErrorMessage: done?.sanitizedErrorMessage ?? null,
  };
}

async function runSync(jobId: string, type: "activities" | "health" | "reconciliation") {
  if (locks.has(type)) {
    await SyncLog.findByIdAndUpdate(jobId, {
      status: "failed",
      completedAt: new Date(),
      errorCode: "SYNC_LOCKED",
      sanitizedErrorMessage: "Another sync of this type is already running.",
    });
    return;
  }

  locks.add(type);
  try {
    const { adapter, conn } = await createAuthenticatedAdapter();

    if (type === "activities" || type === "reconciliation") {
      const since =
        type === "reconciliation" ? undefined : conn.activityWatermark ?? undefined;
      // Pull all activity types for multi-sport coverage (running stays primary UX).
      const activities = await adapter.listActivities(since, {
        activityType: "all",
      });
      let created = 0;
      let updated = 0;

      for (const item of activities) {
        const before = await Activity.findOne({
          garminActivityId: item.garminActivityId,
        }).lean();

        let laps:
          | Array<{
              lapNumber: number;
              distanceMeters?: number;
              durationSeconds?: number;
              averagePaceSecPerKm?: number;
              averageHeartRateBpm?: number;
              splitType?: string;
            }>
          | undefined;
        let samples:
          | Array<{
              timestamp: Date;
              heartRateBpm?: number;
              paceSecPerKm?: number;
              cadenceSpm?: number;
              altitudeMeters?: number;
            }>
          | undefined;
        let routePoints: RoutePoint[] | undefined;
        let routeSource: "garmin_track" | "start_end" | "none" | undefined;
        if (!before) {
          try {
            const detail = await adapter.getActivityDetail(item.garminActivityId);
            laps = detail.laps.length ? detail.laps : undefined;
            const { parseSplitSummaries, parseActivityDetailMetrics } =
              await import("@/modules/activities/detail-metrics");
            if (!laps?.length) {
              const splits = parseSplitSummaries(
                await adapter.get(
                  `/activity-service/activity/${encodeURIComponent(item.garminActivityId)}`
                )
              );
              if (splits.length) laps = splits;
            }
            const charts = await adapter.getActivityDetailsCharts(
              item.garminActivityId
            );
            const parsed = parseActivityDetailMetrics(charts);
            if (parsed.samples.length) samples = parsed.samples;
            if (parsed.routePoints.length) {
              routePoints = parsed.routePoints;
              routeSource = parsed.routeSource;
            }
          } catch {
            // Detail/charts are best-effort; summary still persists.
          }
        }

        await upsertGarminActivity({
          garminActivityId: item.garminActivityId,
          activityType: item.activityType,
          activityName: item.activityName,
          startedAt: new Date(item.startedAt),
          distanceMeters: item.distanceMeters,
          durationSeconds: item.durationSeconds,
          movingDurationSeconds: item.movingDurationSeconds,
          averageHeartRateBpm: item.averageHeartRateBpm,
          maxHeartRateBpm: item.maxHeartRateBpm,
          averageCadenceSpm: item.averageCadenceSpm,
          elevationGainMeters: item.elevationGainMeters,
          calories: item.calories,
          rawPayload: item.raw,
          laps,
          samples,
          routePoints,
          routeSource,
        });
        if (before) updated += 1;
        else created += 1;
      }

      const now = new Date();
      await persistAdapterToken(conn._id, adapter);
      await conn.updateOne({
        lastSuccessfulSyncAt: now,
        lastActivitySyncAt: now,
        activityWatermark: now,
        status: "connected",
      });

      await SyncLog.findByIdAndUpdate(jobId, {
        status: "success",
        completedAt: now,
        recordsFetched: activities.length,
        recordsCreated: created,
        recordsUpdated: updated,
      });
      return;
    }

    if (type === "health") {
      const { syncHealthMetrics } = await import(
        "@/modules/fitness-core/health-sync"
      );
      const { probeCapabilities } = await import(
        "@/modules/fitness-core/capabilities"
      );
      const result = await syncHealthMetrics(adapter);
      await probeCapabilities(adapter);
      const now = new Date();
      await persistAdapterToken(conn._id, adapter);
      await conn.updateOne({
        lastSuccessfulSyncAt: now,
        lastHealthSyncAt: now,
        status: "connected",
      });
      await SyncLog.findByIdAndUpdate(jobId, {
        status: "success",
        completedAt: now,
        recordsFetched: result.days,
        recordsCreated: result.upserted,
        recordsUpdated: 0,
      });
      return;
    }

    throw new GarminAdapterError(
      "SYNC_TYPE_UNSUPPORTED",
      "Unsupported sync type."
    );
  } catch (error) {
    const code =
      error instanceof GarminAdapterError ? error.code : "SYNC_FAILED";
    const message =
      error instanceof Error ? error.message : "Synchronization failed.";
    await SyncLog.findByIdAndUpdate(jobId, {
      status: "failed",
      completedAt: new Date(),
      errorCode: code,
      sanitizedErrorMessage: message,
    });
  } finally {
    locks.delete(type);
  }
}

export async function getSyncStatus() {
  await connectMongo();
  const { GarminConnection } = await import("@/models");
  const [latest, running, conn] = await Promise.all([
    SyncLog.findOne().sort({ startedAt: -1 }).lean(),
    SyncLog.findOne({ status: "running" }).sort({ startedAt: -1 }).lean(),
    GarminConnection.findOne().lean(),
  ]);

  return {
    current: running
      ? {
          jobId: String(running._id),
          type: running.type,
          status: running.status,
          startedAt: running.startedAt,
        }
      : null,
    last: latest
      ? {
          jobId: String(latest._id),
          type: latest.type,
          status: latest.status,
          startedAt: latest.startedAt,
          completedAt: latest.completedAt ?? null,
          errorCode: latest.errorCode ?? null,
          sanitizedErrorMessage: latest.sanitizedErrorMessage ?? null,
        }
      : null,
    lastSuccessfulSyncAt: conn?.lastSuccessfulSyncAt ?? null,
    lastActivitySyncAt: conn?.lastActivitySyncAt ?? null,
    lastHealthSyncAt: conn?.lastHealthSyncAt ?? null,
  };
}

export async function listSyncLogs(page = 1, limit = 20) {
  await connectMongo();
  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage = Math.max(1, page);
  const [items, total] = await Promise.all([
    SyncLog.find()
      .sort({ startedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SyncLog.countDocuments(),
  ]);
  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}
