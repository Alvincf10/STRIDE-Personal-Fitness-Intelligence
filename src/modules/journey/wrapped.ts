import { connectMongo } from "@/lib/database/mongoose";
import { paceFromDistanceDuration } from "@/lib/utils/units";
import { Activity, DailyMetrics } from "@/models";

type RunLean = {
  _id: { toString(): string };
  activityName?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  averagePaceSecPerKm?: number;
  startedAt: Date;
};

function summarizeRuns(
  period: string,
  runs: RunLean[],
  healthDaysWithSleep: number
) {
  const totalDistanceMeters = runs.reduce(
    (sum, r) => sum + (r.distanceMeters ?? 0),
    0
  );
  const totalDurationSeconds = runs.reduce(
    (sum, r) => sum + (r.durationSeconds ?? 0),
    0
  );
  const longest = [...runs].sort(
    (a, b) => (b.distanceMeters ?? 0) - (a.distanceMeters ?? 0)
  )[0];
  const withPace = runs.filter(
    (r) =>
      typeof r.averagePaceSecPerKm === "number" ||
      (r.distanceMeters && r.durationSeconds)
  );
  const fastest = [...withPace].sort((a, b) => {
    const pa =
      a.averagePaceSecPerKm ??
      paceFromDistanceDuration(a.distanceMeters ?? 0, a.durationSeconds ?? 0) ??
      99999;
    const pb =
      b.averagePaceSecPerKm ??
      paceFromDistanceDuration(b.distanceMeters ?? 0, b.durationSeconds ?? 0) ??
      99999;
    return pa - pb;
  })[0];

  return {
    period,
    calculationVersion: "1.0.0",
    activityCount: runs.length,
    totalDistanceMeters,
    totalDurationSeconds,
    averagePaceSecPerKm: paceFromDistanceDuration(
      totalDistanceMeters,
      totalDurationSeconds
    ),
    longestRun: longest
      ? {
          id: String(longest._id),
          activityName: longest.activityName,
          distanceMeters: longest.distanceMeters,
          startedAt: longest.startedAt,
        }
      : null,
    fastestRun: fastest
      ? {
          id: String(fastest._id),
          activityName: fastest.activityName,
          averagePaceSecPerKm:
            fastest.averagePaceSecPerKm ??
            paceFromDistanceDuration(
              fastest.distanceMeters ?? 0,
              fastest.durationSeconds ?? 0
            ),
          startedAt: fastest.startedAt,
        }
      : null,
    healthDaysWithSleep,
    runDays: new Set(
      runs.map((r) => new Date(r.startedAt).toISOString().slice(0, 10))
    ).size,
  };
}

export async function getMonthlyWrapped(yearMonth?: string) {
  await connectMongo();
  const now = new Date();
  const ym =
    yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)
      ? yearMonth
      : now.toISOString().slice(0, 7);

  const [year, month] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const runs = await Activity.find({
    activityType: "running",
    startedAt: { $gte: start, $lt: end },
  })
    .sort({ startedAt: 1 })
    .lean();

  const health = await DailyMetrics.find({
    date: {
      $gte: start.toISOString().slice(0, 10),
      $lt: end.toISOString().slice(0, 10),
    },
  }).lean();

  const sleepNights = health.filter(
    (h) => typeof h.sleepDurationSeconds === "number"
  ).length;

  return summarizeRuns(ym, runs as RunLean[], sleepNights);
}

export async function getAnnualWrapped(year?: number) {
  await connectMongo();
  const now = new Date();
  const y =
    typeof year === "number" && Number.isFinite(year)
      ? year
      : now.getUTCFullYear();
  const start = new Date(Date.UTC(y, 0, 1));
  const end = new Date(Date.UTC(y + 1, 0, 1));

  const runs = await Activity.find({
    activityType: "running",
    startedAt: { $gte: start, $lt: end },
  })
    .sort({ startedAt: 1 })
    .lean();

  const health = await DailyMetrics.find({
    date: {
      $gte: start.toISOString().slice(0, 10),
      $lt: end.toISOString().slice(0, 10),
    },
  }).lean();

  const sleepNights = health.filter(
    (h) => typeof h.sleepDurationSeconds === "number"
  ).length;

  const byMonth: Record<string, number> = {};
  for (const r of runs) {
    const key = new Date(r.startedAt).toISOString().slice(0, 7);
    byMonth[key] = (byMonth[key] ?? 0) + (r.distanceMeters ?? 0);
  }

  const base = summarizeRuns(String(y), runs as RunLean[], sleepNights);
  return {
    ...base,
    monthlyDistanceMeters: Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, distanceMeters]) => ({ month, distanceMeters })),
  };
}
