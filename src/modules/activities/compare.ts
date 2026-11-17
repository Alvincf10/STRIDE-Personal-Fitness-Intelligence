import { connectMongo } from "@/lib/database/mongoose";
import { Activity, ActivityDetail } from "@/models";
import { buildActivityEvaluation } from "@/modules/activities/detail-metrics";
import { calculateDecoupling } from "@/modules/aerobic-decoupling/service";

export async function compareActivities(aId: string, bId: string) {
  await connectMongo();
  const [a, b] = await Promise.all([
    Activity.findById(aId).lean(),
    Activity.findById(bId).lean(),
  ]);
  if (!a || !b) throw new Error("One or both activities were not found.");

  const [da, db] = await Promise.all([
    ActivityDetail.findOne({ activityId: a._id }).lean(),
    ActivityDetail.findOne({ activityId: b._id }).lean(),
  ]);

  const side = async (
    activity: typeof a,
    detail: typeof da
  ) => {
    const evaluation = buildActivityEvaluation(activity);
    const decoupling = calculateDecoupling(
      (detail?.samples ?? []) as Array<{
        timestamp: Date;
        heartRateBpm?: number;
        paceSecPerKm?: number;
      }>
    );
    evaluation.sampleStatus = {
      available: Boolean(detail?.samples?.length),
      explanation: detail?.samples?.length
        ? `${detail.samples.length} samples`
        : "No samples",
    };
    return {
      activity: {
        id: String(activity._id),
        activityName: activity.activityName,
        startedAt: new Date(activity.startedAt).toISOString(),
        distanceMeters: activity.distanceMeters ?? null,
        durationSeconds: activity.durationSeconds ?? null,
        averagePaceSecPerKm: activity.averagePaceSecPerKm ?? null,
        averageHeartRateBpm: activity.averageHeartRateBpm ?? null,
        maxHeartRateBpm: activity.maxHeartRateBpm ?? null,
        averageCadenceSpm: activity.averageCadenceSpm ?? null,
        elevationGainMeters: activity.elevationGainMeters ?? null,
      },
      evaluation,
      decoupling: {
        eligible: decoupling.eligible,
        decouplingPercent: decoupling.decouplingPercent,
        ineligibleReason: decoupling.ineligibleReason,
      },
      sampleCount: detail?.samples?.length ?? 0,
      routeCount: detail?.routePoints?.length ?? 0,
    };
  };

  const left = await side(a, da);
  const right = await side(b, db);

  const delta = {
    distanceMeters:
      left.activity.distanceMeters != null &&
      right.activity.distanceMeters != null
        ? Number(
            (
              right.activity.distanceMeters - left.activity.distanceMeters
            ).toFixed(1)
          )
        : null,
    paceSecPerKm:
      left.activity.averagePaceSecPerKm != null &&
      right.activity.averagePaceSecPerKm != null
        ? Number(
            (
              right.activity.averagePaceSecPerKm -
              left.activity.averagePaceSecPerKm
            ).toFixed(1)
          )
        : null,
    averageHeartRateBpm:
      left.activity.averageHeartRateBpm != null &&
      right.activity.averageHeartRateBpm != null
        ? Number(
            (
              right.activity.averageHeartRateBpm -
              left.activity.averageHeartRateBpm
            ).toFixed(1)
          )
        : null,
  };

  return {
    calculationVersion: "1.0.0",
    left,
    right,
    delta,
    note: "Descriptive side-by-side only. Positive pace delta = slower.",
    evaluatedAt: new Date().toISOString(),
  };
}
