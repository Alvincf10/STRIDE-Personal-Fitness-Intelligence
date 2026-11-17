import { connectMongo } from "@/lib/database/mongoose";
import { paceFromDistanceDuration } from "@/lib/utils/units";
import { Activity } from "@/models";
import { getOrCreateHrZones } from "@/modules/settings/service";

type BandKey = "z1" | "z2" | "z3" | "z4" | "z5" | "unclassified";

function bandForHr(
  hr: number,
  zones: Array<{ zone: number; minBpm: number; maxBpm: number }>
): BandKey {
  const match = zones.find((z) => hr >= z.minBpm && hr <= z.maxBpm);
  if (!match || match.zone < 1 || match.zone > 5) return "unclassified";
  return `z${match.zone}` as BandKey;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function periodStart(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Pace-at-effort using whole-activity average HR + pace.
 * Documented limited method — not sample-level efficiency.
 */
export async function getAerobicEfficiency(params?: {
  days?: number;
  compareDays?: number;
}) {
  await connectMongo();
  const days = Math.min(90, Math.max(14, params?.days ?? 28));
  const compareDays = Math.min(90, Math.max(14, params?.compareDays ?? days));
  const zones = await getOrCreateHrZones();
  const currentFrom = periodStart(days);
  const previousFrom = periodStart(days + compareDays);
  const previousTo = currentFrom;

  const runs = await Activity.find({
    activityType: "running",
    startedAt: { $gte: previousFrom },
    averageHeartRateBpm: { $ne: null },
    distanceMeters: { $gte: 3000 },
  })
    .sort({ startedAt: -1 })
    .lean();

  type Obs = {
    id: string;
    activityName?: string;
    startedAt: string;
    averageHeartRateBpm: number;
    paceSecPerKm: number;
    distanceMeters: number;
    band: BandKey;
  };

  const observations: Obs[] = [];
  for (const run of runs) {
    const pace =
      run.averagePaceSecPerKm ??
      paceFromDistanceDuration(run.distanceMeters ?? 0, run.durationSeconds ?? 0);
    if (
      typeof run.averageHeartRateBpm !== "number" ||
      pace == null ||
      !Number.isFinite(pace)
    ) {
      continue;
    }
    observations.push({
      id: String(run._id),
      activityName: run.activityName,
      startedAt: new Date(run.startedAt).toISOString(),
      averageHeartRateBpm: run.averageHeartRateBpm,
      paceSecPerKm: pace,
      distanceMeters: run.distanceMeters ?? 0,
      band: bandForHr(run.averageHeartRateBpm, zones.zones),
    });
  }

  const current = observations.filter(
    (o) => new Date(o.startedAt) >= currentFrom
  );
  const previous = observations.filter((o) => {
    const t = new Date(o.startedAt);
    return t >= previousFrom && t < previousTo;
  });

  const summarize = (obs: Obs[]) => {
    const byBand: Record<
      string,
      {
        band: string;
        sampleCount: number;
        medianPaceSecPerKm: number | null;
        totalDistanceMeters: number;
        activityIds: string[];
      }
    > = {};
    for (const band of ["z1", "z2", "z3", "z4", "z5", "unclassified"]) {
      const rows = obs.filter((o) => o.band === band);
      byBand[band] = {
        band,
        sampleCount: rows.length,
        medianPaceSecPerKm: median(rows.map((r) => r.paceSecPerKm)),
        totalDistanceMeters: rows.reduce((s, r) => s + r.distanceMeters, 0),
        activityIds: rows.map((r) => r.id),
      };
    }
    return byBand;
  };

  const currentBands = summarize(current);
  const previousBands = summarize(previous);
  const minimumSampleCount = 3;
  const usableBands = Object.values(currentBands).filter(
    (b) => b.band !== "unclassified" && b.sampleCount > 0
  );
  const readyBands = usableBands.filter(
    (b) => b.sampleCount >= minimumSampleCount
  );

  const status =
    readyBands.length > 0
      ? ("ready" as const)
      : usableBands.length > 0
        ? ("limited" as const)
        : ("insufficient_data" as const);

  const comparisons = ["z1", "z2", "z3", "z4", "z5"].map((band) => {
    const cur = currentBands[band];
    const prev = previousBands[band];
    const delta =
      cur.medianPaceSecPerKm != null && prev.medianPaceSecPerKm != null
        ? Number((cur.medianPaceSecPerKm - prev.medianPaceSecPerKm).toFixed(1))
        : null;
    return {
      band,
      current: cur,
      previous: prev,
      paceDeltaSecPerKm: delta,
      note:
        delta == null
          ? "Insufficient paired periods for this HR band."
          : delta < 0
            ? "Median pace faster than previous period at similar avg HR (descriptive only)."
            : delta > 0
              ? "Median pace slower than previous period at similar avg HR (descriptive only)."
              : "Median pace unchanged vs previous period.",
    };
  });

  return {
    available: status !== "insufficient_data",
    status,
    calculationVersion: "1.0.0",
    method: "activity_avg_hr_band_median_pace",
    sourceLabel:
      "Whole-activity average HR and pace binned into your configured STRIDE HR zones",
    limitations: [
      "Not sample-level aerobic decoupling or continuous efficiency.",
      "Terrain, heat, fatigue, and route are confounders — do not treat deltas as pure fitness change.",
      "Requires runs ≥ 3 km with average HR.",
    ],
    windowDays: days,
    compareDays,
    minimumSampleCount,
    qualifyingActivityCount: current.length,
    previousActivityCount: previous.length,
    zoneSettingsSource: "user_settings",
    bands: currentBands,
    comparisons,
    observations: current.slice(0, 30),
    explanation:
      status === "insufficient_data"
        ? "Need runs ≥ 3 km with average HR before pace-at-effort bands can be shown."
        : status === "limited"
          ? "Some HR bands have observations, but below the preferred sample threshold."
          : "Median pace by average-HR band for the selected window.",
    evaluatedAt: new Date().toISOString(),
  };
}
