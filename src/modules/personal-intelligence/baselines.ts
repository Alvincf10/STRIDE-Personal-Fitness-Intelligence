import { connectMongo } from "@/lib/database/mongoose";
import { Activity, DailyMetrics, PersonalBaseline } from "@/models";

const CALC_VERSION = "1.0.0";

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mad(values: number[], med: number) {
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

export async function recalculateBaselines() {
  await connectMongo();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 56 * 86400000);
  const saved = [];

  const rhrSamples = await DailyMetrics.find({
    date: {
      $gte: windowStart.toISOString().slice(0, 10),
      $lte: now.toISOString().slice(0, 10),
    },
    restingHeartRateBpm: { $ne: null },
  }).lean();
  const rhrValues = rhrSamples
    .map((d) => d.restingHeartRateBpm)
    .filter((v): v is number => typeof v === "number");
  if (rhrValues.length >= 7) {
    const value = median(rhrValues)!;
    saved.push(
      await PersonalBaseline.create({
        metric: "resting_hr",
        windowStart,
        windowEnd: now,
        sampleCount: rhrValues.length,
        minimumSampleCount: 7,
        method: "median_56d",
        value,
        dispersion: mad(rhrValues, value),
        unit: "bpm",
        calculationVersion: CALC_VERSION,
        generatedAt: now,
      })
    );
  }

  const hrvSamples = await DailyMetrics.find({
    date: {
      $gte: windowStart.toISOString().slice(0, 10),
      $lte: now.toISOString().slice(0, 10),
    },
    hrvMs: { $ne: null },
  }).lean();
  const hrvValues = hrvSamples
    .map((d) => d.hrvMs)
    .filter((v): v is number => typeof v === "number");
  if (hrvValues.length >= 7) {
    const value = median(hrvValues)!;
    saved.push(
      await PersonalBaseline.create({
        metric: "hrv",
        windowStart,
        windowEnd: now,
        sampleCount: hrvValues.length,
        minimumSampleCount: 7,
        method: "median_56d",
        value,
        dispersion: mad(hrvValues, value),
        unit: "ms",
        calculationVersion: CALC_VERSION,
        generatedAt: now,
      })
    );
  }

  const activities = await Activity.find({
    activityType: "running",
    startedAt: { $gte: windowStart, $lte: now },
    distanceMeters: { $ne: null },
  }).lean();
  const weekly = new Map<string, number>();
  for (const a of activities) {
    const d = new Date(a.startedAt);
    const day = d.getUTCDay() || 7;
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    if (day !== 1) monday.setUTCDate(monday.getUTCDate() - (day - 1));
    const key = monday.toISOString().slice(0, 10);
    weekly.set(key, (weekly.get(key) ?? 0) + (a.distanceMeters ?? 0) / 1000);
  }
  const weeklyValues = [...weekly.values()];
  if (weeklyValues.length >= 3) {
    const value = median(weeklyValues)!;
    saved.push(
      await PersonalBaseline.create({
        metric: "weekly_distance",
        windowStart,
        windowEnd: now,
        sampleCount: weeklyValues.length,
        minimumSampleCount: 3,
        method: "median_weekly_km_56d",
        value,
        dispersion: mad(weeklyValues, value),
        unit: "km",
        calculationVersion: CALC_VERSION,
        generatedAt: now,
      })
    );
  }

  return saved.map((s) => s.toObject());
}

export async function getLatestBaselines() {
  await connectMongo();
  const metrics = [
    "resting_hr",
    "hrv",
    "sleep_duration",
    "pace_at_hr",
    "weekly_distance",
  ] as const;
  const latest = [];
  for (const metric of metrics) {
    const doc = await PersonalBaseline.findOne({ metric })
      .sort({ generatedAt: -1 })
      .lean();
    if (doc) latest.push(doc);
  }
  return latest;
}

export async function getRunningDna() {
  await connectMongo();
  const now = new Date();
  const from = new Date(now.getTime() - 56 * 86400000);
  const runs = await Activity.find({
    activityType: "running",
    startedAt: { $gte: from, $lte: now },
  }).lean();

  const longRuns = runs.filter((r) => (r.distanceMeters ?? 0) >= 8000).length;
  const withHr = runs.filter((r) => typeof r.averageHeartRateBpm === "number");
  const days = new Set(
    runs.map((r) => new Date(r.startedAt).toISOString().slice(0, 10))
  ).size;

  const dimensions = [
    {
      dimension: "endurance",
      score: Math.min(100, longRuns * 20),
      evidence: `${longRuns} runs ≥ 8 km in 56 days`,
    },
    {
      dimension: "consistency",
      score: Math.min(100, days * 8),
      evidence: `${days} unique run days in 56 days`,
    },
    {
      dimension: "aerobic_efficiency",
      score: withHr.length
        ? Math.min(100, Math.round((withHr.length / Math.max(runs.length, 1)) * 100))
        : 0,
      evidence: `${withHr.length}/${runs.length} runs with average HR`,
    },
    {
      dimension: "speed",
      score: runs.some((r) => (r.averagePaceSecPerKm ?? 9999) < 330) ? 60 : 30,
      evidence: "Descriptive index from recent pace samples only",
    },
    {
      dimension: "recovery",
      score: 0,
      evidence: "Filled when HRV/RHR baselines exist",
    },
  ];

  const baselines = await getLatestBaselines();
  if (baselines.some((b) => b.metric === "hrv" || b.metric === "resting_hr")) {
    const recovery = dimensions.find((d) => d.dimension === "recovery");
    if (recovery) {
      recovery.score = 55;
      recovery.evidence = "Personal HRV/RHR baselines available";
    }
  }

  return {
    calculationVersion: CALC_VERSION,
    windowDays: 56,
    methodology:
      "Internal descriptive index from activity and baseline availability. Not a clinical score.",
    dimensions,
  };
}
