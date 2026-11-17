import { connectMongo } from "@/lib/database/mongoose";
import { metersToKm } from "@/lib/utils/units";
import { Activity, DailyMetrics } from "@/models";
import { getTrainingLoad } from "@/modules/training-load/service";
import { getHrZoneIntelligence } from "@/modules/hr-zones/service";
import { getDailySuggestion } from "@/modules/running-coach/daily-suggestion";

export async function getWeeklyReport() {
  await connectMongo();
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);

  const runs = await Activity.find({
    activityType: "running",
    startedAt: { $gte: start, $lte: end },
  })
    .sort({ startedAt: 1 })
    .lean();

  const daily = await DailyMetrics.find({
    date: {
      $gte: start.toISOString().slice(0, 10),
      $lte: end.toISOString().slice(0, 10),
    },
  })
    .sort({ date: 1 })
    .lean();

  const [load, zones, coach] = await Promise.all([
    getTrainingLoad({ days: 28 }),
    getHrZoneIntelligence({ days: 7 }),
    getDailySuggestion(),
  ]);

  const distanceKm = metersToKm(
    runs.reduce((s, r) => s + (r.distanceMeters ?? 0), 0)
  );
  const durationSeconds = runs.reduce(
    (s, r) => s + (r.durationSeconds ?? 0),
    0
  );

  return {
    calculationVersion: "1.0.0",
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
      label: "Last 7 days",
    },
    running: {
      activityCount: runs.length,
      distanceKm: Number(distanceKm.toFixed(2)),
      durationSeconds: Number(durationSeconds.toFixed(0)),
      activities: runs.map((r) => ({
        id: String(r._id),
        name: r.activityName,
        startedAt: new Date(r.startedAt).toISOString(),
        distanceMeters: r.distanceMeters ?? null,
        averagePaceSecPerKm: r.averagePaceSecPerKm ?? null,
        averageHeartRateBpm: r.averageHeartRateBpm ?? null,
      })),
    },
    wellness: {
      days: daily.length,
      avgBodyBattery: avg(
        daily.map((d) => d.bodyBattery).filter((v): v is number => typeof v === "number")
      ),
      avgStress: avg(
        daily.map((d) => d.stressLevel).filter((v): v is number => typeof v === "number")
      ),
      avgSteps: avg(
        daily.map((d) => d.steps).filter((v): v is number => typeof v === "number")
      ),
    },
    performance: {
      strideLoad7d: load.volume.last7Days.strideEstimatedLoad,
      formScore: load.available ? load.impulseResponse.formScore : 0,
      formAvailable: load.available,
      zone2Percent: zones.zone2?.percent ?? null,
    },
    coach: {
      title: coach.title,
      workoutType: coach.workoutType,
      description: coach.description,
    },
    shareText: [
      `STRIDE weekly · ${distanceKm.toFixed(1)} km · ${runs.length} runs`,
      zones.zone2 ? `Zone 2 ${zones.zone2.percent}%` : null,
      load.available
        ? `Form ${load.impulseResponse.formScore.toFixed(1)}`
        : null,
      `Coach: ${coach.title}`,
    ]
      .filter(Boolean)
      .join(" · "),
    evaluatedAt: new Date().toISOString(),
  };
}

function avg(values: number[]) {
  if (!values.length) return null;
  return Number(
    (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
  );
}
