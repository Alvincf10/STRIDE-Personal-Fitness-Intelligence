import { connectMongo } from "@/lib/database/mongoose";
import { metersToKm } from "@/lib/utils/units";
import { Activity, Recommendation } from "@/models";
import { getZoneDistribution } from "@/modules/analytics/service";
import {
  evaluatePaceProgression,
  evaluateWeeklyVolume,
  evaluateZone2Consistency,
} from "./rules";

function weekWindow(reference: Date, weeksAgo: number) {
  const end = new Date(reference);
  end.setUTCDate(end.getUTCDate() - weeksAgo * 7);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

async function distanceInWindow(start: Date, end: Date) {
  const activities = await Activity.find({
    activityType: "running",
    startedAt: { $gte: start, $lt: end },
  }).lean();
  return activities.reduce(
    (sum, a) => sum + (typeof a.distanceMeters === "number" ? a.distanceMeters : 0),
    0
  );
}

export async function evaluateRecommendations() {
  await connectMongo();
  const now = new Date();
  const current = weekWindow(now, 0);
  const previous = weekWindow(now, 1);

  const [currentMeters, previousMeters, zones, recentRuns] = await Promise.all([
    distanceInWindow(current.start, current.end),
    distanceInWindow(previous.start, previous.end),
    getZoneDistribution(),
    Activity.find({ activityType: "running" })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const volume = evaluateWeeklyVolume(
    metersToKm(currentMeters),
    metersToKm(previousMeters)
  );

  const classified =
    zones.available && zones.distribution
      ? zones.distribution.z1 +
        zones.distribution.z2 +
        zones.distribution.z3 +
        zones.distribution.z4 +
        zones.distribution.z5
      : undefined;

  const zone2 = evaluateZone2Consistency({
    zone2Seconds: zones.available ? zones.distribution?.z2 : undefined,
    totalClassifiedSeconds: classified,
  });

  const withPace = recentRuns.filter(
    (r) => typeof r.averagePaceSecPerKm === "number"
  );
  const recent = withPace.slice(0, 3);
  const baseline = withPace.slice(3, 6);
  const avg = (rows: typeof withPace) =>
    rows.length
      ? rows.reduce((s, r) => s + (r.averagePaceSecPerKm ?? 0), 0) / rows.length
      : undefined;

  const pace = evaluatePaceProgression({
    recentPaceSecPerKm: avg(recent),
    baselinePaceSecPerKm: avg(baseline),
  });

  const results = [volume, zone2, pace];
  const saved = [];

  for (const result of results) {
    if (result.status !== "triggered" && result.status !== "insufficient_data") {
      continue;
    }
    if (result.status === "insufficient_data") {
      // Persist insufficient_data only when we want visibility; skip noise for MVP.
      continue;
    }

    const doc = await Recommendation.create({
      ruleId: result.ruleId,
      ruleVersion: result.ruleVersion,
      category:
        result.ruleId === "RUN-001"
          ? "heart_rate"
          : result.ruleId === "RUN-006"
            ? "performance"
            : "training",
      severity: result.severity ?? "info",
      title: result.ruleId,
      description: result.explanation,
      evidence: result.evidence,
      dataSufficiency: "sufficient",
      confidence: "medium",
      status: "active",
      generatedAt: now,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });
    saved.push(doc.toObject());
  }

  return { evaluated: results, saved };
}

export async function listRecommendations(status: "active" | "all" = "active") {
  await connectMongo();
  const filter = status === "active" ? { status: "active" } : {};
  return Recommendation.find(filter).sort({ generatedAt: -1 }).lean();
}

export async function dismissRecommendation(id: string) {
  await connectMongo();
  return Recommendation.findByIdAndUpdate(
    id,
    { status: "dismissed" },
    { new: true }
  ).lean();
}
