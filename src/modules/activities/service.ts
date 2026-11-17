import { connectMongo } from "@/lib/database/mongoose";
import { paceFromDistanceDuration } from "@/lib/utils/units";
import { Activity, ActivityDetail } from "@/models";
import {
  buildActivityEvaluation,
  parseActivityDetailMetrics,
  parseSplitSummaries,
} from "@/modules/activities/detail-metrics";
import {
  extractRouteFromPayload,
  type RoutePoint,
} from "@/modules/activities/route-geo";

export async function listActivities(params: {
  from?: Date;
  to?: Date;
  type?: string;
  page?: number;
  limit?: number;
}) {
  await connectMongo();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const filter: Record<string, unknown> = {};

  if (params.type) filter.activityType = params.type;
  if (params.from || params.to) {
    filter.startedAt = {};
    if (params.from) (filter.startedAt as Record<string, Date>).$gte = params.from;
    if (params.to) (filter.startedAt as Record<string, Date>).$lte = params.to;
  }

  const [items, total] = await Promise.all([
    Activity.find(filter)
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Activity.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getActivityById(id: string) {
  await connectMongo();
  const activity = await Activity.findById(id).lean();
  if (!activity) return null;
  let detail = await ActivityDetail.findOne({ activityId: activity._id }).lean();

  const needsSamples = !(detail?.samples && detail.samples.length > 0);
  const needsTrack = !(detail?.routePoints && detail.routePoints.length > 2);
  const needsLaps = !(detail?.laps && detail.laps.length > 0);

  // Enrich from Garmin /details when samples/track missing (Personal API charts).
  if ((needsSamples || needsTrack || needsLaps) && activity.garminActivityId) {
    try {
      const { createAuthenticatedAdapter, persistAdapterToken } = await import(
        "@/modules/garmin/connection-service"
      );
      const { adapter, conn } = await createAuthenticatedAdapter();
      const charts = await adapter.getActivityDetailsCharts(
        activity.garminActivityId
      );
      const parsed = parseActivityDetailMetrics(charts);

      let laps = detail?.laps ?? [];
      if (needsLaps) {
        try {
          const summaryPayload = await adapter.get(
            `/activity-service/activity/${encodeURIComponent(activity.garminActivityId)}`
          );
          const splits = parseSplitSummaries(summaryPayload);
          if (splits.length) laps = splits;
        } catch {
          // splitSummaries optional
        }
      }

      if (
        parsed.samples.length ||
        parsed.routePoints.length ||
        laps.length
      ) {
        detail = await ActivityDetail.findOneAndUpdate(
          { activityId: activity._id },
          {
            $set: {
              samples: parsed.samples.length
                ? parsed.samples
                : (detail?.samples ?? []),
              routePoints: parsed.routePoints.length
                ? parsed.routePoints
                : (detail?.routePoints ?? []),
              routeSource: parsed.routePoints.length
                ? parsed.routeSource
                : (detail?.routeSource ?? "none"),
              laps: laps.length ? laps : (detail?.laps ?? []),
            },
          },
          { upsert: true, new: true }
        ).lean();
      }
      await persistAdapterToken(conn._id, adapter);
    } catch {
      // Keep summary-only view when Garmin enrich fails.
    }
  }

  // Backfill start/end route from stored Garmin summary when track was never synced.
  if (
    (!detail?.routePoints || detail.routePoints.length < 2) &&
    activity.rawPayload
  ) {
    const extracted = extractRouteFromPayload(
      activity.rawPayload as Record<string, unknown>
    );
    if (extracted.points.length > 0) {
      detail = await ActivityDetail.findOneAndUpdate(
        { activityId: activity._id },
        {
          $set: {
            routePoints: extracted.points,
            routeSource: extracted.source,
            laps: detail?.laps ?? [],
            samples: detail?.samples ?? [],
          },
        },
        { upsert: true, new: true }
      ).lean();
    }
  }

  const evaluation = buildActivityEvaluation(activity);
  evaluation.sampleStatus = {
    available: Boolean(detail?.samples && detail.samples.length > 0),
    explanation:
      detail?.samples && detail.samples.length > 0
        ? `${detail.samples.length} Garmin chart samples (HR/pace/cadence) stored from /activity/details.`
        : "No time-series samples stored yet. Open this page while Garmin is connected to enrich, or re-sync activities.",
  };

  return { activity, detail, evaluation };
}

export async function getActivitySummary(from: Date, to: Date, type = "running") {
  await connectMongo();
  const activities = await Activity.find({
    activityType: type,
    startedAt: { $gte: from, $lte: to },
  }).lean();

  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let hrSum = 0;
  let hrCount = 0;
  let maxHr: number | undefined;

  for (const a of activities) {
    if (typeof a.distanceMeters === "number") totalDistanceMeters += a.distanceMeters;
    if (typeof a.durationSeconds === "number") totalDurationSeconds += a.durationSeconds;
    if (typeof a.averageHeartRateBpm === "number") {
      hrSum += a.averageHeartRateBpm;
      hrCount += 1;
    }
    if (typeof a.maxHeartRateBpm === "number") {
      maxHr =
        maxHr == null ? a.maxHeartRateBpm : Math.max(maxHr, a.maxHeartRateBpm);
    }
  }

  const averagePaceSecPerKm = paceFromDistanceDuration(
    totalDistanceMeters,
    totalDurationSeconds
  );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    activityCount: activities.length,
    totalDistanceMeters,
    totalDurationSeconds,
    averagePaceSecPerKm,
    averageHeartRateBpm: hrCount ? hrSum / hrCount : undefined,
    maxHeartRateBpm: maxHr,
  };
}

export async function upsertGarminActivity(input: {
  garminActivityId: string;
  activityType: string;
  activityName?: string;
  startedAt: Date;
  timezone?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  movingDurationSeconds?: number;
  averageHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  averageCadenceSpm?: number;
  maxCadenceSpm?: number;
  elevationGainMeters?: number;
  calories?: number;
  rawPayload?: Record<string, unknown>;
  laps?: Array<{
    lapNumber: number;
    distanceMeters?: number;
    durationSeconds?: number;
    averagePaceSecPerKm?: number;
    averageHeartRateBpm?: number;
  }>;
  samples?: Array<{
    timestamp: Date;
    heartRateBpm?: number;
    paceSecPerKm?: number;
    cadenceSpm?: number;
    altitudeMeters?: number;
  }>;
  routePoints?: RoutePoint[];
  routeSource?: "garmin_track" | "start_end" | "none";
}) {
  await connectMongo();
  const averagePaceSecPerKm = paceFromDistanceDuration(
    input.distanceMeters ?? 0,
    input.durationSeconds ?? 0
  );

  const fromRaw = extractRouteFromPayload(input.rawPayload);
  const routePoints = input.routePoints?.length
    ? input.routePoints
    : fromRaw.points;
  const routeSource = input.routeSource ?? fromRaw.source;

  const activity = await Activity.findOneAndUpdate(
    { garminActivityId: input.garminActivityId },
    {
      $set: {
        activityType: input.activityType,
        activityName: input.activityName,
        startedAt: input.startedAt,
        timezone: input.timezone,
        distanceMeters: input.distanceMeters,
        durationSeconds: input.durationSeconds,
        movingDurationSeconds: input.movingDurationSeconds,
        averagePaceSecPerKm,
        averageHeartRateBpm: input.averageHeartRateBpm,
        maxHeartRateBpm: input.maxHeartRateBpm,
        averageCadenceSpm: input.averageCadenceSpm,
        maxCadenceSpm: input.maxCadenceSpm,
        elevationGainMeters: input.elevationGainMeters,
        calories: input.calories,
        source: "garmin",
        rawPayload: input.rawPayload,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (input.laps || input.samples || routePoints.length) {
    await ActivityDetail.findOneAndUpdate(
      { activityId: activity._id },
      {
        $set: {
          laps: input.laps ?? [],
          samples: input.samples ?? [],
          routePoints,
          routeSource,
        },
      },
      { upsert: true, new: true }
    );
  }

  return activity;
}
