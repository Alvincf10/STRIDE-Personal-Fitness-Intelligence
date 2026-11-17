import { connectMongo } from "@/lib/database/mongoose";
import { paceFromDistanceDuration } from "@/lib/utils/units";
import { Activity, ActivityDetail, DailyMetrics } from "@/models";
import { getOrCreateHrZones } from "@/modules/settings/service";

export const CALCULATION_VERSION = "1.0.0";

export async function getOverview(from: Date, to: Date) {
  await connectMongo();
  const activities = await Activity.find({
    activityType: "running",
    startedAt: { $gte: from, $lte: to },
  })
    .sort({ startedAt: -1 })
    .lean();

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

  const weeklyBuckets = bucketByWeek(activities);

  return {
    calculationVersion: CALCULATION_VERSION,
    period: { from: from.toISOString(), to: to.toISOString() },
    totalDistanceMeters,
    totalDurationSeconds,
    activityCount: activities.length,
    averagePaceSecPerKm: paceFromDistanceDuration(
      totalDistanceMeters,
      totalDurationSeconds
    ),
    averageHeartRateBpm: hrCount ? hrSum / hrCount : undefined,
    maxHeartRateBpm: maxHr,
    weeklyDistanceTrend: weeklyBuckets,
    recentActivities: activities.slice(0, 8),
  };
}

function bucketByWeek(
  activities: Array<{ startedAt: Date; distanceMeters?: number | null }>
) {
  const map = new Map<string, number>();
  for (const a of activities) {
    const d = new Date(a.startedAt);
    const key = startOfIsoWeek(d).toISOString().slice(0, 10);
    const prev = map.get(key) ?? 0;
    map.set(key, prev + (a.distanceMeters ?? 0));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, distanceMeters]) => ({ weekStart, distanceMeters }));
}

function startOfIsoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

export async function getPaceProgression(from: Date, to: Date) {
  await connectMongo();
  const activities = await Activity.find({
    activityType: "running",
    startedAt: { $gte: from, $lte: to },
    distanceMeters: { $gte: 3000 },
  })
    .sort({ startedAt: 1 })
    .lean();

  return activities.map((a) => ({
    id: String(a._id),
    startedAt: a.startedAt,
    distanceMeters: a.distanceMeters,
    averagePaceSecPerKm:
      a.averagePaceSecPerKm ??
      paceFromDistanceDuration(a.distanceMeters ?? 0, a.durationSeconds ?? 0),
    averageHeartRateBpm: a.averageHeartRateBpm,
  }));
}

export async function getHeartRateTrends(from: Date, to: Date) {
  await connectMongo();
  const [activities, daily] = await Promise.all([
    Activity.find({
      activityType: "running",
      startedAt: { $gte: from, $lte: to },
    })
      .sort({ startedAt: 1 })
      .lean(),
    DailyMetrics.find({
      date: {
        $gte: from.toISOString().slice(0, 10),
        $lte: to.toISOString().slice(0, 10),
      },
    })
      .sort({ date: 1 })
      .lean(),
  ]);

  return {
    sessionHeartRate: activities.map((a) => ({
      startedAt: a.startedAt,
      averageHeartRateBpm: a.averageHeartRateBpm,
      maxHeartRateBpm: a.maxHeartRateBpm,
    })),
    restingHeartRate: daily.map((d) => ({
      date: d.date,
      restingHeartRateBpm: d.restingHeartRateBpm,
    })),
  };
}

export async function getZoneDistribution(activityId?: string) {
  await connectMongo();
  const zones = await getOrCreateHrZones();

  // Prefer Garmin-provided hrTimeInZone_* summaries when present.
  const { extractGarminZoneSeconds } = await import(
    "@/modules/hr-zones/service"
  );
  if (activityId) {
    const activity = await Activity.findById(activityId).lean();
    const garminZones = extractGarminZoneSeconds(
      (activity?.rawPayload ?? null) as Record<string, unknown> | null
    );
    if (garminZones) {
      const total =
        garminZones.z1 +
        garminZones.z2 +
        garminZones.z3 +
        garminZones.z4 +
        garminZones.z5;
      if (total > 0) {
        return {
          available: true as const,
          source: "garmin_summary" as const,
          zones: zones.zones,
          method: zones.method,
          distribution: { ...garminZones, unclassified: 0 },
        };
      }
    }
  }

  let samples: Array<{ heartRateBpm?: number | null; timestamp: Date }> = [];

  if (activityId) {
    const detail = await ActivityDetail.findOne({ activityId }).lean();
    samples = detail?.samples ?? [];
  } else {
    const recent = await Activity.find({ activityType: "running" })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean();
    const details = await ActivityDetail.find({
      activityId: { $in: recent.map((a) => a._id) },
    }).lean();
    samples = details.flatMap((d) => d.samples ?? []);
  }

  const hrSamples = samples.filter(
    (s): s is { heartRateBpm: number; timestamp: Date } =>
      typeof s.heartRateBpm === "number"
  );

  if (hrSamples.length < 2) {
    return {
      available: false as const,
      reason: "insufficient_hr_samples",
      zones: zones.zones,
      distribution: null,
    };
  }

  const distribution = {
    z1: 0,
    z2: 0,
    z3: 0,
    z4: 0,
    z5: 0,
    unclassified: 0,
  };

  // Assume ~1s between consecutive samples when timestamps are irregular.
  for (let i = 0; i < hrSamples.length - 1; i++) {
    const hr = hrSamples[i].heartRateBpm;
    const dt = Math.max(
      0,
      Math.min(
        5,
        (hrSamples[i + 1].timestamp.getTime() - hrSamples[i].timestamp.getTime()) /
          1000
      )
    );
    const zone = zones.zones.find(
      (z: { zone: number; minBpm: number; maxBpm: number }) =>
        hr >= z.minBpm && hr <= z.maxBpm
    );
    if (!zone) {
      distribution.unclassified += dt;
    } else if (zone.zone >= 1 && zone.zone <= 5) {
      const key = `z${zone.zone}` as keyof typeof distribution;
      distribution[key] += dt;
    } else {
      distribution.unclassified += dt;
    }
  }

  return {
    available: true as const,
    zones: zones.zones,
    method: zones.method,
    distribution,
  };
}

export async function getVo2MaxTrend(from: Date, to: Date) {
  await connectMongo();
  const daily = await DailyMetrics.find({
    date: {
      $gte: from.toISOString().slice(0, 10),
      $lte: to.toISOString().slice(0, 10),
    },
    vo2Max: { $ne: null },
  })
    .sort({ date: 1 })
    .lean();

  if (daily.length === 0) {
    return { available: false as const, points: [] };
  }

  return {
    available: true as const,
    points: daily.map((d) => ({ date: d.date, vo2Max: d.vo2Max })),
  };
}
