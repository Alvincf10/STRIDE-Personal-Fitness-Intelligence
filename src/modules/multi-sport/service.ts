import { connectMongo } from "@/lib/database/mongoose";
import { Activity } from "@/models";

export async function getMultiSportOverview(params?: { days?: number }) {
  await connectMongo();
  const days = Math.min(180, Math.max(7, params?.days ?? 90));
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days);

  const activities = await Activity.find({ startedAt: { $gte: from } })
    .sort({ startedAt: -1 })
    .lean();

  const byType = new Map<
    string,
    {
      activityType: string;
      count: number;
      totalDurationSeconds: number;
      totalDistanceMeters: number;
      lastStartedAt: string | null;
    }
  >();

  for (const a of activities) {
    const key = a.activityType || "unknown";
    const cur = byType.get(key) ?? {
      activityType: key,
      count: 0,
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
      lastStartedAt: null,
    };
    cur.count += 1;
    cur.totalDurationSeconds += a.durationSeconds ?? 0;
    cur.totalDistanceMeters += a.distanceMeters ?? 0;
    if (!cur.lastStartedAt) {
      cur.lastStartedAt = new Date(a.startedAt).toISOString();
    }
    byType.set(key, cur);
  }

  const sports = [...byType.values()].sort((a, b) => b.count - a.count);
  const nonRunning = sports.filter((s) => s.activityType !== "running");

  const status =
    nonRunning.length > 0
      ? ("ready" as const)
      : activities.length > 0
        ? ("limited" as const)
        : ("insufficient_data" as const);

  return {
    available: activities.length > 0,
    status,
    calculationVersion: "1.0.0",
    method: "activity_type_taxonomy",
    sourceLabel: "Garmin activity list (all synced activity types)",
    windowDays: days,
    sports,
    recent: activities.slice(0, 20).map((a) => ({
      id: String(a._id),
      activityName: a.activityName,
      activityType: a.activityType,
      startedAt: new Date(a.startedAt).toISOString(),
      durationSeconds: a.durationSeconds ?? null,
      distanceMeters: a.distanceMeters ?? null,
    })),
    explanation:
      status === "insufficient_data"
        ? "No activities synced yet."
        : status === "limited"
          ? "Only running activities synced so far. Use multi-sport sync to pull other types."
          : "Activity mix across synced sports.",
    evaluatedAt: new Date().toISOString(),
  };
}
