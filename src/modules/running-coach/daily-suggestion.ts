import { connectMongo } from "@/lib/database/mongoose";
import { metersToKm } from "@/lib/utils/units";
import { Activity } from "@/models";
import { getHrZoneIntelligence } from "@/modules/hr-zones/service";
import { getLatestBaselines } from "@/modules/personal-intelligence/baselines";
import { evaluateWeeklyVolume } from "@/modules/recommendations/rules";
import { getRecoveryOverview } from "@/modules/recovery/service";
import { getTrainingLoad } from "@/modules/training-load/service";

export type WorkoutType =
  | "easy"
  | "recovery"
  | "tempo"
  | "interval"
  | "long_run"
  | "rest";

export type DailySuggestion = {
  ruleId: string;
  ruleVersion: string;
  workoutType: WorkoutType;
  title: string;
  description: string;
  suggestedDistanceKm?: { min: number; max: number };
  suggestedDurationMinutes?: { min: number; max: number };
  suggestedZone?: string;
  severity: "info" | "low" | "medium" | "high";
  dataSufficiency: "sufficient" | "insufficient";
  confidence: "high" | "medium" | "low";
  evidence: Array<{
    metric: string;
    value: number | string;
    unit?: string;
    threshold?: number;
  }>;
  generatedAt: string;
  expiresAt: string;
};

function weekWindow(reference: Date, weeksAgo: number) {
  const end = new Date(reference);
  end.setUTCDate(end.getUTCDate() - weeksAgo * 7);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end };
}

async function distanceKm(start: Date, end: Date) {
  const activities = await Activity.find({
    activityType: "running",
    startedAt: { $gte: start, $lt: end },
  }).lean();
  const meters = activities.reduce(
    (sum, a) => sum + (a.distanceMeters ?? 0),
    0
  );
  return metersToKm(meters);
}

export async function getDailySuggestion(): Promise<DailySuggestion> {
  await connectMongo();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 18 * 60 * 60 * 1000);

  const [recovery, baselines, currentKm, previousKm, recentRuns, load, zones] =
    await Promise.all([
      getRecoveryOverview(),
      getLatestBaselines(),
      distanceKm(weekWindow(now, 0).start, weekWindow(now, 0).end),
      distanceKm(weekWindow(now, 1).start, weekWindow(now, 1).end),
      Activity.find({ activityType: "running" })
        .sort({ startedAt: -1 })
        .limit(14)
        .lean(),
      getTrainingLoad({ days: 28 }),
      getHrZoneIntelligence({ days: 14 }),
    ]);

  const volume = evaluateWeeklyVolume(currentKm, previousKm, 20);
  const weeklyBaseline = baselines.find((b) => b.metric === "weekly_distance");
  const ranToday = recentRuns.some(
    (r) =>
      new Date(r.startedAt).toISOString().slice(0, 10) ===
      now.toISOString().slice(0, 10)
  );
  const daysSinceLast = recentRuns[0]
    ? Math.floor(
        (now.getTime() - new Date(recentRuns[0].startedAt).getTime()) /
          86400000
      )
    : 99;
  const formScore = load.available ? load.impulseResponse.formScore : null;
  const zone2Percent = zones.available ? zones.zone2?.percent ?? null : null;

  const evidence: DailySuggestion["evidence"] = [
    { metric: "recoveryStatus", value: recovery.status },
    { metric: "currentWeekKm", value: Number(currentKm.toFixed(2)), unit: "km" },
    { metric: "previousWeekKm", value: Number(previousKm.toFixed(2)), unit: "km" },
    { metric: "daysSinceLastRun", value: daysSinceLast, unit: "days" },
    { metric: "ranToday", value: ranToday ? "yes" : "no" },
  ];
  if (formScore != null) {
    evidence.push({ metric: "formScore", value: Number(formScore.toFixed(1)) });
  }
  if (zone2Percent != null) {
    evidence.push({
      metric: "zone2Percent14d",
      value: zone2Percent,
      unit: "%",
    });
  }

  if (weeklyBaseline) {
    evidence.push({
      metric: "weeklyDistanceBaselineKm",
      value: Number(weeklyBaseline.value.toFixed(2)),
      unit: "km",
    });
  }

  // Recovery caution takes precedence over high intensity (PRD F-01).
  if (
    recovery.status === "easier_session" ||
    recovery.status === "attention"
  ) {
    return {
      ruleId: "COACH-REC-001",
      ruleVersion: "2.0.0",
      workoutType: recovery.status === "easier_session" ? "rest" : "recovery",
      title:
        recovery.status === "easier_session"
          ? "Rest or very easy spin"
          : "Keep it easy today",
      description:
        "Recovery indicators need attention relative to your personal baselines. Prefer rest or an easy Zone 2 session.",
      suggestedDistanceKm:
        recovery.status === "easier_session"
          ? undefined
          : { min: 3, max: 6 },
      suggestedDurationMinutes:
        recovery.status === "easier_session"
          ? undefined
          : { min: 20, max: 40 },
      suggestedZone: "Zone 2",
      severity: "medium",
      dataSufficiency: "sufficient",
      confidence: "medium",
      evidence,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  // Coach v2: Banister form deeply negative → protect.
  if (formScore != null && formScore < -12) {
    return {
      ruleId: "COACH-LOAD-001",
      ruleVersion: "2.0.0",
      workoutType: "recovery",
      title: "Load says ease off",
      description:
        "STRIDE form (chronic − acute) is quite negative. Keep today easy or rest so fatigue can settle.",
      suggestedDistanceKm: { min: 3, max: 6 },
      suggestedDurationMinutes: { min: 20, max: 40 },
      suggestedZone: "Zone 2",
      severity: "medium",
      dataSufficiency: "sufficient",
      confidence: "medium",
      evidence,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  // Coach v2: thin Zone 2 share → aerobic focus.
  if (zone2Percent != null && zone2Percent < 35 && zones.eligibleActivityCount >= 1) {
    return {
      ruleId: "COACH-Z2-001",
      ruleVersion: "2.0.0",
      workoutType: "easy",
      title: "Rebuild Zone 2 share",
      description:
        "Recent zone summaries show limited Zone 2 time. Prioritize conversational aerobic work today.",
      suggestedDistanceKm: { min: 5, max: 9 },
      suggestedDurationMinutes: { min: 35, max: 55 },
      suggestedZone: "Zone 2",
      severity: "low",
      dataSufficiency: "sufficient",
      confidence: "medium",
      evidence,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  if (ranToday) {
    return {
      ruleId: "COACH-DONE-001",
      ruleVersion: "2.0.0",
      workoutType: "rest",
      title: "You already trained today",
      description:
        "A run is already logged for today. Focus on fueling and sleep unless your plan explicitly stacks sessions.",
      severity: "info",
      dataSufficiency: "sufficient",
      confidence: "high",
      evidence,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  if (volume.status === "triggered") {
    return {
      ruleId: "COACH-VOL-001",
      ruleVersion: "2.0.0",
      workoutType: "easy",
      title: "Easy volume day",
      description:
        "Weekly volume rose past the review threshold versus last week. Keep intensity controlled.",
      suggestedDistanceKm: { min: 4, max: 8 },
      suggestedDurationMinutes: { min: 30, max: 50 },
      suggestedZone: "Zone 2",
      severity: "medium",
      dataSufficiency: "sufficient",
      confidence: "medium",
      evidence: [
        ...evidence,
        ...volume.evidence,
      ],
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  if (daysSinceLast >= 3) {
    return {
      ruleId: "COACH-EASY-001",
      ruleVersion: "2.0.0",
      workoutType: "easy",
      title: "Ease back in",
      description:
        "A few days since the last run. An easy aerobic session rebuilds consistency without stacking load.",
      suggestedDistanceKm: { min: 4, max: 7 },
      suggestedDurationMinutes: { min: 25, max: 45 },
      suggestedZone: "Zone 2",
      severity: "info",
      dataSufficiency: recentRuns.length ? "sufficient" : "insufficient",
      confidence: recentRuns.length ? "medium" : "low",
      evidence,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  const weekday = now.getUTCDay(); // 0 Sun
  if (weekday === 0 || weekday === 6) {
    const longTarget =
      weeklyBaseline && weeklyBaseline.value > 0
        ? {
            min: Math.max(8, Number((weeklyBaseline.value * 0.3).toFixed(1))),
            max: Math.max(10, Number((weeklyBaseline.value * 0.4).toFixed(1))),
          }
        : { min: 8, max: 12 };
    return {
      ruleId: "COACH-LONG-001",
      ruleVersion: "2.0.0",
      workoutType: "long_run",
      title: "Long run window",
      description:
        "Weekend slot favors aerobic endurance. Keep most of the run conversational.",
      suggestedDistanceKm: longTarget,
      suggestedZone: "Zone 2",
      severity: "info",
      dataSufficiency: weeklyBaseline ? "sufficient" : "insufficient",
      confidence: weeklyBaseline ? "medium" : "low",
      evidence,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  // Tempo only when form is not deeply fatigued.
  if (
    (weekday === 2 || weekday === 4) &&
    (formScore == null || formScore >= -8)
  ) {
    return {
      ruleId: "COACH-TEMPO-001",
      ruleVersion: "2.0.0",
      workoutType: "tempo",
      title: "Optional tempo stimulus",
      description:
        "Recovery and STRIDE form look stable enough for a short tempo block. Optional, not required.",
      suggestedDistanceKm: { min: 5, max: 9 },
      suggestedDurationMinutes: { min: 30, max: 50 },
      suggestedZone: "Zone 3–4",
      severity: "low",
      dataSufficiency:
        recovery.status === "insufficient_data" ? "insufficient" : "sufficient",
      confidence: recovery.status === "ok" ? "medium" : "low",
      evidence,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  return {
    ruleId: "COACH-EASY-002",
    ruleVersion: "2.0.0",
    workoutType: "easy",
    title: "Steady easy run",
    description:
      "Default aerobic day. Stay mostly in Zone 2 and leave room for the week ahead.",
    suggestedDistanceKm: { min: 5, max: 8 },
    suggestedDurationMinutes: { min: 30, max: 50 },
    suggestedZone: "Zone 2",
    severity: "info",
    dataSufficiency: recentRuns.length >= 3 ? "sufficient" : "insufficient",
    confidence: "medium",
    evidence,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}
