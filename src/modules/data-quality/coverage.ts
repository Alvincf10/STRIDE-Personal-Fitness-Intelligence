import { connectMongo } from "@/lib/database/mongoose";
import { Activity, ActivityDetail, DailyMetrics } from "@/models";
import { extractGarminZoneSeconds } from "@/modules/hr-zones/service";
import type { MetricAvailability } from "@/modules/data-quality/types";

function pct(part: number, whole: number) {
  if (whole <= 0) return null;
  return Number(((part / whole) * 100).toFixed(1));
}

export async function getDataCoverage() {
  await connectMongo();
  const [activities, details, daily] = await Promise.all([
    Activity.find({ activityType: "running" }).lean(),
    ActivityDetail.find().lean(),
    DailyMetrics.find().lean(),
  ]);

  const detailByActivity = new Map(
    details.map((d) => [String(d.activityId), d])
  );

  let withHr = 0;
  let withCadence = 0;
  let withElev = 0;
  let withGps = 0;
  let withLaps = 0;
  let withSamples = 0;
  let withZoneSummary = 0;

  for (const a of activities) {
    if (typeof a.averageHeartRateBpm === "number") withHr += 1;
    if (typeof a.averageCadenceSpm === "number") withCadence += 1;
    if (typeof a.elevationGainMeters === "number") withElev += 1;
    const raw = (a.rawPayload ?? {}) as Record<string, unknown>;
    if (
      typeof raw.startLatitude === "number" &&
      typeof raw.startLongitude === "number"
    ) {
      withGps += 1;
    }
    const zones = extractGarminZoneSeconds(raw);
    if (zones && zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5 > 0) {
      withZoneSummary += 1;
    }
    const detail = detailByActivity.get(String(a._id));
    if ((detail?.laps?.length ?? 0) > 0) withLaps += 1;
    if ((detail?.samples?.length ?? 0) > 0) withSamples += 1;
  }

  const metric = (
    key: string,
    label: string,
    count: number,
    sourceEndpoint: string,
    lastObservedAt: string | null,
    emptyExplanation: string
  ): MetricAvailability => {
    if (count <= 0) {
      return {
        metricKey: key,
        label,
        status: "empty",
        recordCount: 0,
        lastObservedAt: null,
        sourceEndpoint,
        explanation: emptyExplanation,
      };
    }
    return {
      metricKey: key,
      label,
      status: "available",
      recordCount: count,
      lastObservedAt,
      sourceEndpoint,
      explanation: `${count} observation(s) stored.`,
    };
  };

  const lastDaily = [...daily].sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastActivity = [...activities].sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )[0];

  const metrics: MetricAvailability[] = [
    metric(
      "activities.running",
      "Running activities",
      activities.length,
      "activitylist-service",
      lastActivity?.startedAt
        ? new Date(lastActivity.startedAt).toISOString()
        : null,
      "No running activities synced yet."
    ),
    {
      metricKey: "activities.hr_average",
      label: "Average HR on runs",
      status:
        activities.length === 0
          ? "not_synced"
          : withHr === 0
            ? "empty"
            : withHr < activities.length
              ? "partial"
              : "available",
      recordCount: withHr,
      lastObservedAt: lastActivity?.startedAt
        ? new Date(lastActivity.startedAt).toISOString()
        : null,
      sourceEndpoint: "activitylist-service",
      explanation:
        activities.length === 0
          ? "No activities synced."
          : `${withHr}/${activities.length} runs have average HR.`,
    },
    {
      metricKey: "activities.hr_samples",
      label: "HR time-series samples",
      status: withSamples > 0 ? "available" : "empty",
      recordCount: withSamples,
      lastObservedAt: null,
      sourceEndpoint: "activity-service",
      explanation:
        withSamples > 0
          ? `${withSamples} activities have HR samples.`
          : "No HR samples stored. Sample-based decoupling stays insufficient.",
    },
    {
      metricKey: "activities.hr_zone_summary",
      label: "Garmin HR zone summaries",
      status:
        activities.length === 0
          ? "not_synced"
          : withZoneSummary === 0
            ? "empty"
            : withZoneSummary < activities.length
              ? "partial"
              : "available",
      recordCount: withZoneSummary,
      lastObservedAt: null,
      sourceEndpoint: "activitylist-service",
      explanation:
        withZoneSummary > 0
          ? `${withZoneSummary}/${activities.length} runs include hrTimeInZone_* summaries.`
          : "No Garmin hrTimeInZone_* fields on synced runs.",
    },
    {
      metricKey: "activities.laps",
      label: "Lap / split data",
      status: withLaps > 0 ? "available" : "empty",
      recordCount: withLaps,
      lastObservedAt: null,
      sourceEndpoint: "activity-service",
      explanation:
        withLaps > 0
          ? `${withLaps} activities have laps.`
          : "No lap data stored for synced activities.",
    },
    {
      metricKey: "activities.gps",
      label: "GPS start/end",
      status:
        activities.length === 0
          ? "not_synced"
          : withGps === 0
            ? "empty"
            : withGps < activities.length
              ? "partial"
              : "available",
      recordCount: withGps,
      lastObservedAt: null,
      sourceEndpoint: "activitylist-service",
      explanation: `${withGps}/${activities.length} runs include start coordinates.`,
    },
    metric(
      "daily.rhr",
      "Resting heart rate",
      daily.filter((d) => typeof d.restingHeartRateBpm === "number").length,
      "usersummary-service",
      lastDaily?.date ?? null,
      "No RHR days stored. Run health sync."
    ),
    metric(
      "daily.hrv",
      "Nightly HRV",
      daily.filter((d) => typeof d.hrvMs === "number").length,
      "hrv-service",
      lastDaily?.date ?? null,
      "No HRV days stored."
    ),
    metric(
      "daily.sleep",
      "Sleep duration",
      daily.filter((d) => typeof d.sleepDurationSeconds === "number").length,
      "sleep-service",
      lastDaily?.date ?? null,
      "No sleep days stored."
    ),
    metric(
      "daily.stress",
      "Stress level",
      daily.filter((d) => typeof d.stressLevel === "number").length,
      "usersummary-service",
      lastDaily?.date ?? null,
      "No stress values stored."
    ),
    metric(
      "daily.body_battery",
      "Body Battery",
      daily.filter((d) => typeof d.bodyBattery === "number").length,
      "usersummary-service / wellness-service",
      lastDaily?.date ?? null,
      "No Body Battery values stored."
    ),
    metric(
      "daily.body_battery_series",
      "Body Battery intraday",
      daily.filter((d) => (d.bodyBatterySeries?.length ?? 0) > 0).length,
      "wellness-service/bodyBattery/reports/daily",
      lastDaily?.date ?? null,
      "No Body Battery intraday series stored."
    ),
    metric(
      "daily.vo2max",
      "VO2 Max",
      daily.filter((d) => typeof d.vo2Max === "number").length,
      "metrics-service",
      lastDaily?.date ?? null,
      "No VO2 Max days stored."
    ),
    metric(
      "daily.steps",
      "Steps",
      daily.filter((d) => typeof d.steps === "number").length,
      "usersummary-service",
      lastDaily?.date ?? null,
      "No step days stored."
    ),
  ];

  return {
    window: {
      activityCount: activities.length,
      dailyMetricDays: daily.length,
      firstActivityAt: activities.length
        ? new Date(
            Math.min(...activities.map((a) => new Date(a.startedAt).getTime()))
          ).toISOString()
        : null,
      lastActivityAt: lastActivity?.startedAt
        ? new Date(lastActivity.startedAt).toISOString()
        : null,
    },
    activityCoverage: {
      withAverageHrPct: pct(withHr, activities.length),
      withCadencePct: pct(withCadence, activities.length),
      withElevationPct: pct(withElev, activities.length),
      withGpsPct: pct(withGps, activities.length),
      withLapsPct: pct(withLaps, activities.length),
      withHrSamplesPct: pct(withSamples, activities.length),
      withZoneSummaryPct: pct(withZoneSummary, activities.length),
      withAverageHr: withHr,
      withCadence,
      withElevation: withElev,
      withGps,
      withLaps,
      withHrSamples: withSamples,
      withZoneSummary,
    },
    metrics,
    evaluatedAt: new Date().toISOString(),
  };
}
