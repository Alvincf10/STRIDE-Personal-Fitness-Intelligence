import { connectMongo } from "@/lib/database/mongoose";
import { metersToKm } from "@/lib/utils/units";
import { Activity, FitnessGoal } from "@/models";
import { getAerobicDecoupling } from "@/modules/aerobic-decoupling/service";
import { getTrainingLoad } from "@/modules/training-load/service";

const DISTANCE_PRESETS: Record<string, number> = {
  "1k": 1000,
  "5k": 5000,
  "10k": 10000,
  half_marathon: 21097.5,
  marathon: 42195,
};

export async function listGoals() {
  await connectMongo();
  return FitnessGoal.find().sort({ createdAt: -1 }).lean();
}

export async function createGoal(input: {
  type: "1k" | "5k" | "10k" | "half_marathon" | "marathon" | "custom";
  title: string;
  targetDistanceMeters?: number;
  targetTimeSeconds?: number;
  targetDate?: string;
  notes?: string;
}) {
  await connectMongo();
  const distance =
    input.targetDistanceMeters ?? DISTANCE_PRESETS[input.type] ?? undefined;
  return FitnessGoal.create({
    type: input.type,
    title: input.title,
    targetDistanceMeters: distance,
    targetTimeSeconds: input.targetTimeSeconds,
    targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
    notes: input.notes,
    status: "active",
  });
}

export async function updateGoal(
  id: string,
  patch: Partial<{
    title: string;
    status: "active" | "paused" | "completed" | "cancelled";
    targetDistanceMeters: number;
    targetTimeSeconds: number;
    targetDate: string | null;
    notes: string;
  }>
) {
  await connectMongo();
  const update: Record<string, unknown> = { ...patch };
  if (patch.targetDate === null) {
    delete update.targetDate;
    update.$unset = { targetDate: 1 };
  } else if (typeof patch.targetDate === "string") {
    update.targetDate = new Date(patch.targetDate);
  }
  return FitnessGoal.findByIdAndUpdate(id, update, { new: true }).lean();
}

function paceOf(run: {
  averagePaceSecPerKm?: number;
  distanceMeters?: number;
  durationSeconds?: number;
}) {
  if (typeof run.averagePaceSecPerKm === "number") return run.averagePaceSecPerKm;
  if (run.distanceMeters && run.durationSeconds && run.distanceMeters > 0) {
    return run.durationSeconds / (run.distanceMeters / 1000);
  }
  return undefined;
}

export async function getGoalProgress() {
  await connectMongo();
  const goals = await listGoals();
  const now = new Date();
  const from28 = new Date(now.getTime() - 28 * 86400000);
  const [runs, load, decoupling] = await Promise.all([
    Activity.find({ activityType: "running" }).sort({ startedAt: -1 }).lean(),
    getTrainingLoad({ days: 42 }),
    getAerobicDecoupling({ days: 28 }),
  ]);
  const recent = runs.filter((r) => new Date(r.startedAt) >= from28);
  const volume28dKm = metersToKm(
    recent.reduce((sum, r) => sum + (r.distanceMeters ?? 0), 0)
  );
  const runDays28 = new Set(
    recent.map((r) => new Date(r.startedAt).toISOString().slice(0, 10))
  ).size;
  const formScore = load.available ? load.impulseResponse.formScore : null;
  const latestDecoupling = decoupling.sessions.find((s) => s.eligible) ?? null;

  return goals.map((goal) => {
    const target = goal.targetDistanceMeters;
    const candidates = runs.filter(
      (r) =>
        typeof target === "number" &&
        (r.distanceMeters ?? 0) >= target * 0.5 &&
        paceOf(r) != null
    );
    const best = target
      ? [...candidates].sort((a, b) => {
          const covA = Math.min(1, (a.distanceMeters ?? 0) / target);
          const covB = Math.min(1, (b.distanceMeters ?? 0) / target);
          if (covB !== covA) return covB - covA;
          return (paceOf(a) ?? 99999) - (paceOf(b) ?? 99999);
        })[0]
      : runs[0];

    const coverage =
      target && best?.distanceMeters
        ? Math.min(1, best.distanceMeters / target)
        : 0;
    const evidenceEnough = Boolean(target && candidates.length >= 1 && coverage >= 0.5);

    let estimateSeconds: number | undefined;
    let method: string | undefined;
    if (
      evidenceEnough &&
      best?.distanceMeters &&
      best.durationSeconds &&
      target &&
      best.distanceMeters > 0
    ) {
      const ratio = target / best.distanceMeters;
      estimateSeconds = best.durationSeconds * Math.pow(ratio, 1.06);
      method = "riegel_1.06_from_best_coverage_effort";
    }

    const factors: Array<{
      id: string;
      label: string;
      status: "ok" | "weak" | "missing";
      value: string;
    }> = [
      {
        id: "coverage",
        label: "Distance coverage",
        status:
          coverage >= 0.9 ? "ok" : coverage >= 0.5 ? "weak" : "missing",
        value: target
          ? `${Math.round(coverage * 100)}% of target`
          : "No target distance",
      },
      {
        id: "evidence_runs",
        label: "Comparable efforts",
        status:
          candidates.length >= 3
            ? "ok"
            : candidates.length >= 1
              ? "weak"
              : "missing",
        value: `${candidates.length} run(s) ≥ 50% target`,
      },
      {
        id: "recent_volume",
        label: "28-day volume",
        status:
          volume28dKm >= 20 ? "ok" : volume28dKm >= 8 ? "weak" : "missing",
        value: `${volume28dKm.toFixed(1)} km`,
      },
      {
        id: "consistency",
        label: "28-day run days",
        status: runDays28 >= 8 ? "ok" : runDays28 >= 3 ? "weak" : "missing",
        value: `${runDays28} days`,
      },
      {
        id: "training_form",
        label: "Training form",
        status:
          formScore == null
            ? "missing"
            : formScore >= -8
              ? "ok"
              : formScore >= -15
                ? "weak"
                : "missing",
        value:
          formScore == null
            ? "No STRIDE load yet"
            : `Form ${formScore.toFixed(1)} (CTL−ATL)`,
      },
      {
        id: "decoupling",
        label: "Recent aerobic decoupling",
        status:
          latestDecoupling?.decouplingPercent == null
            ? "missing"
            : latestDecoupling.decouplingPercent <= 5
              ? "ok"
              : latestDecoupling.decouplingPercent <= 10
                ? "weak"
                : "missing",
        value:
          latestDecoupling?.decouplingPercent == null
            ? "No eligible sample session"
            : `${latestDecoupling.decouplingPercent}% on latest eligible run`,
      },
    ];

    const okCount = factors.filter((f) => f.status === "ok").length;
    const missingCount = factors.filter((f) => f.status === "missing").length;
    let confidence: "high" | "medium" | "low" | "insufficient" = "insufficient";
    if (!evidenceEnough || missingCount >= 4) {
      confidence = "insufficient";
    } else if (okCount >= 4 && coverage >= 0.9) {
      confidence = "high";
    } else if (okCount >= 3 || coverage >= 0.75) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    // Fatigue / high decoupling widens the estimate band.
    const fatiguePad =
      (formScore != null && formScore < -12 ? 0.03 : 0) +
      (latestDecoupling?.decouplingPercent != null &&
      latestDecoupling.decouplingPercent > 8
        ? 0.02
        : 0);

    const rangePad =
      (confidence === "high" ? 0.04 : confidence === "medium" ? 0.06 : 0.1) +
      fatiguePad;

    return {
      goal,
      progress: {
        bestMatchingActivityId: best ? String(best._id) : null,
        bestDistanceMeters: best?.distanceMeters,
        bestDurationSeconds: best?.durationSeconds,
        estimateSeconds,
        estimateRangeSeconds: estimateSeconds
          ? {
              low: Math.round(estimateSeconds * (1 - rangePad * 0.5)),
              high: Math.round(estimateSeconds * (1 + rangePad)),
            }
          : null,
        method: method
          ? `${method}+load_decoupling_context`
          : method,
        confidence,
        factors,
        evidence: {
          comparableRuns: candidates.length,
          coverageRatio: Number(coverage.toFixed(3)),
          volume28dKm: Number(volume28dKm.toFixed(2)),
          runDays28,
        },
        note:
          confidence === "insufficient"
            ? "Insufficient distance-specific evidence for a prediction."
            : "Statistical estimate only. Not a guaranteed race time.",
      },
    };
  });
}
