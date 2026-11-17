import { connectMongo } from "@/lib/database/mongoose";
import { Activity, DailyMetrics } from "@/models";
import { getOrCreateSettings } from "@/modules/settings/service";

export async function getEnergyTimeline(params?: { date?: string }) {
  await connectMongo();
  const settings = await getOrCreateSettings();
  const timezone = settings.timezone || "Asia/Jakarta";

  const latest = await DailyMetrics.findOne()
    .sort({ date: -1 })
    .select({ date: 1 })
    .lean();
  const date = params?.date ?? latest?.date ?? new Date().toISOString().slice(0, 10);

  const day = await DailyMetrics.findOne({ date }).lean();
  const availableDates = await DailyMetrics.find()
    .sort({ date: -1 })
    .limit(28)
    .select({ date: 1 })
    .lean();

  if (!day) {
    return {
      available: false,
      status: "insufficient_data" as const,
      date,
      timezone,
      explanation: "No daily metrics for this date. Run health sync first.",
      availableDates: availableDates.map((d) => d.date),
      tracks: null,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const activities = await Activity.find({
    startedAt: { $gte: dayStart, $lt: dayEnd },
  })
    .sort({ startedAt: 1 })
    .lean();

  const bbSeries = ((day.bodyBatterySeries ?? []) as Array<{ t: Date; v: number }>)
    .filter((p) => typeof p.v === "number")
    .map((p) => ({
      t: new Date(p.t).toISOString(),
      v: p.v,
      missing: false,
    }));

  // Represent gaps: consecutive points > 45 min apart get a gap marker (not interpolated).
  const bbWithGaps: Array<{
    t: string;
    v: number | null;
    missing: boolean;
  }> = [];
  for (let i = 0; i < bbSeries.length; i++) {
    if (i > 0) {
      const prev = new Date(bbSeries[i - 1].t).getTime();
      const cur = new Date(bbSeries[i].t).getTime();
      if (cur - prev > 45 * 60 * 1000) {
        bbWithGaps.push({
          t: new Date(prev + 60 * 1000).toISOString(),
          v: null,
          missing: true,
        });
      }
    }
    bbWithGaps.push(bbSeries[i]);
  }

  const hasBb = bbWithGaps.some((p) => !p.missing);
  const hasStress = typeof day.stressLevel === "number";
  const status =
    hasBb && hasStress
      ? ("ready" as const)
      : hasBb || hasStress
        ? ("limited" as const)
        : ("insufficient_data" as const);

  return {
    available: status !== "insufficient_data",
    status,
    date,
    timezone,
    sourceLabel: "Garmin Body Battery reports + daily stress + activities",
    limitations: [
      "Missing intervals are marked, not interpolated.",
      "Stress track uses daily aggregate unless intraday stress series is stored.",
      "Descriptive only — not causal.",
    ],
    coverage: {
      bodyBatteryPoints: bbSeries.length,
      stressDaily: hasStress,
      activityCount: activities.length,
      sleepWindow:
        day.sleepStartAt && day.sleepEndAt
          ? {
              start: new Date(day.sleepStartAt).toISOString(),
              end: new Date(day.sleepEndAt).toISOString(),
            }
          : null,
    },
    daily: {
      bodyBattery: day.bodyBattery ?? null,
      bodyBatteryCharged: day.bodyBatteryCharged ?? null,
      bodyBatteryDrained: day.bodyBatteryDrained ?? null,
      stressLevel: day.stressLevel ?? null,
      stressMaxLevel: day.stressMaxLevel ?? null,
      restingHeartRateBpm: day.restingHeartRateBpm ?? null,
      steps: day.steps ?? null,
      sleepDurationSeconds: day.sleepDurationSeconds ?? null,
    },
    tracks: {
      bodyBattery: bbWithGaps,
      stressDaily: hasStress
        ? {
            level: day.stressLevel!,
            maxLevel: day.stressMaxLevel ?? null,
            note: "Daily aggregate from Garmin stress summary.",
          }
        : null,
      sleep:
        day.sleepStartAt && day.sleepEndAt
          ? {
              start: new Date(day.sleepStartAt).toISOString(),
              end: new Date(day.sleepEndAt).toISOString(),
              durationSeconds: day.sleepDurationSeconds ?? null,
            }
          : null,
      activities: activities.map((a) => ({
        id: String(a._id),
        name: a.activityName,
        type: a.activityType,
        start: new Date(a.startedAt).toISOString(),
        durationSeconds: a.durationSeconds ?? null,
      })),
    },
    availableDates: availableDates.map((d) => d.date),
    explanation:
      status === "ready"
        ? `Energy timeline for ${date} (${timezone}).`
        : status === "limited"
          ? "Partial wellness coverage for this day."
          : "Insufficient Body Battery/stress for a timeline.",
    evaluatedAt: new Date().toISOString(),
  };
}
