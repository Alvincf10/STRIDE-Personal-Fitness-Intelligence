import { connectMongo } from "@/lib/database/mongoose";
import { DailyMetrics } from "@/models";

export async function getDailyMovement(params?: { days?: number }) {
  await connectMongo();
  const days = Math.min(90, Math.max(7, params?.days ?? 28));
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days);
  const fromKey = from.toISOString().slice(0, 10);

  const rows = await DailyMetrics.find({ date: { $gte: fromKey } })
    .sort({ date: 1 })
    .lean();

  const withSteps = rows.filter((r) => typeof r.steps === "number");
  const status =
    withSteps.length >= 7
      ? ("ready" as const)
      : withSteps.length > 0
        ? ("limited" as const)
        : ("insufficient_data" as const);

  const totalSteps = withSteps.reduce((s, r) => s + (r.steps ?? 0), 0);
  const avgSteps = withSteps.length
    ? Math.round(totalSteps / withSteps.length)
    : null;
  const goalHits = withSteps.filter(
    (r) =>
      typeof r.stepsGoal === "number" &&
      typeof r.steps === "number" &&
      r.steps >= r.stepsGoal
  ).length;

  return {
    available: withSteps.length > 0,
    status,
    calculationVersion: "1.0.0",
    method: "garmin_daily_movement_summaries",
    sourceLabel: "Garmin daily summary movement.steps / floors / intensity",
    windowDays: days,
    summary: {
      daysWithSteps: withSteps.length,
      totalSteps,
      averageSteps: avgSteps,
      goalHitDays: goalHits,
      totalFloors: rows.reduce((s, r) => s + (r.floorsAscended ?? 0), 0),
      totalIntensityMinutes: rows.reduce(
        (s, r) => s + (r.intensityMinutes ?? 0),
        0
      ),
    },
    daily: rows.map((r) => ({
      date: r.date,
      steps: r.steps ?? null,
      stepsGoal: r.stepsGoal ?? null,
      floorsAscended: r.floorsAscended ?? null,
      intensityMinutes: r.intensityMinutes ?? null,
      goalMet:
        typeof r.steps === "number" && typeof r.stepsGoal === "number"
          ? r.steps >= r.stepsGoal
          : null,
    })),
    explanation:
      status === "insufficient_data"
        ? "No step days stored. Re-run health sync."
        : "Daily steps/floors/intensity from Garmin wellness summaries.",
    evaluatedAt: new Date().toISOString(),
  };
}
