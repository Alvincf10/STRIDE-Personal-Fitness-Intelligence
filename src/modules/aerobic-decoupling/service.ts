import { connectMongo } from "@/lib/database/mongoose";
import { Activity, ActivityDetail } from "@/models";

export const CALCULATION_VERSION = "1.0.0";
export const METHOD = "half_split_speed_over_hr";

/** Minimum moving samples with both HR and pace. */
export const MIN_PAIRED_SAMPLES = 40;
/** Drop first/last fraction as crude warm-up / cool-down. */
export const EDGE_TRIM_FRACTION = 0.05;
/** Prefer sessions at least this long (seconds). */
export const MIN_DURATION_SECONDS = 20 * 60;

export type SamplePoint = {
  timestamp: Date | string;
  heartRateBpm?: number | null;
  paceSecPerKm?: number | null;
};

export type DecouplingResult = {
  eligible: boolean;
  ineligibleReason: string | null;
  decouplingPercent: number | null;
  firstHalf: {
    sampleCount: number;
    meanHr: number | null;
    meanPaceSecPerKm: number | null;
    meanSpeedMps: number | null;
    efficiencySpeedPerHr: number | null;
  };
  secondHalf: {
    sampleCount: number;
    meanHr: number | null;
    meanPaceSecPerKm: number | null;
    meanSpeedMps: number | null;
    efficiencySpeedPerHr: number | null;
  };
  sampleCoverage: {
    totalSamples: number;
    pairedSamples: number;
    usedSamples: number;
    trimmedEachEnd: number;
  };
  method: string;
  calculationVersion: string;
};

function mean(values: number[]) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Aerobic decoupling from time-series HR + pace.
 * EF = mean(speed) / mean(HR). Positive % = second-half efficiency drop (HR drift).
 * Never uses whole-activity averages alone.
 */
export function calculateDecoupling(samples: SamplePoint[]): DecouplingResult {
  const base = {
    method: METHOD,
    calculationVersion: CALCULATION_VERSION,
  };

  const paired = samples
    .map((s) => {
      const hr =
        typeof s.heartRateBpm === "number" && s.heartRateBpm > 0
          ? s.heartRateBpm
          : null;
      const pace =
        typeof s.paceSecPerKm === "number" &&
        Number.isFinite(s.paceSecPerKm) &&
        s.paceSecPerKm > 0
          ? s.paceSecPerKm
          : null;
      if (hr == null || pace == null) return null;
      const speedMps = 1000 / pace;
      return {
        t: new Date(s.timestamp).getTime(),
        hr,
        pace,
        speedMps,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.t - b.t);

  if (paired.length < MIN_PAIRED_SAMPLES) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: `Need ≥${MIN_PAIRED_SAMPLES} paired HR+pace samples (have ${paired.length}).`,
      decouplingPercent: null,
      firstHalf: emptyHalf(),
      secondHalf: emptyHalf(),
      sampleCoverage: {
        totalSamples: samples.length,
        pairedSamples: paired.length,
        usedSamples: 0,
        trimmedEachEnd: 0,
      },
    };
  }

  const durationSec = (paired[paired.length - 1].t - paired[0].t) / 1000;
  if (durationSec < MIN_DURATION_SECONDS) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: `Sample span ${Math.round(durationSec / 60)} min < ${MIN_DURATION_SECONDS / 60} min minimum.`,
      decouplingPercent: null,
      firstHalf: emptyHalf(),
      secondHalf: emptyHalf(),
      sampleCoverage: {
        totalSamples: samples.length,
        pairedSamples: paired.length,
        usedSamples: 0,
        trimmedEachEnd: 0,
      },
    };
  }

  const trim = Math.floor(paired.length * EDGE_TRIM_FRACTION);
  const core = paired.slice(trim, Math.max(trim + 1, paired.length - trim));
  if (core.length < MIN_PAIRED_SAMPLES) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: "Too few samples after warm-up/cool-down trim.",
      decouplingPercent: null,
      firstHalf: emptyHalf(),
      secondHalf: emptyHalf(),
      sampleCoverage: {
        totalSamples: samples.length,
        pairedSamples: paired.length,
        usedSamples: core.length,
        trimmedEachEnd: trim,
      },
    };
  }

  const mid = Math.floor(core.length / 2);
  const first = core.slice(0, mid);
  const second = core.slice(mid);
  const h1 = summarizeHalf(first);
  const h2 = summarizeHalf(second);

  let decouplingPercent: number | null = null;
  if (
    h1.efficiencySpeedPerHr != null &&
    h2.efficiencySpeedPerHr != null &&
    h1.efficiencySpeedPerHr > 0
  ) {
    decouplingPercent = Number(
      (
        ((h1.efficiencySpeedPerHr - h2.efficiencySpeedPerHr) /
          h1.efficiencySpeedPerHr) *
        100
      ).toFixed(2)
    );
  }

  return {
    ...base,
    eligible: decouplingPercent != null,
    ineligibleReason:
      decouplingPercent == null ? "Could not compute half efficiencies." : null,
    decouplingPercent,
    firstHalf: h1,
    secondHalf: h2,
    sampleCoverage: {
      totalSamples: samples.length,
      pairedSamples: paired.length,
      usedSamples: core.length,
      trimmedEachEnd: trim,
    },
  };
}

function emptyHalf() {
  return {
    sampleCount: 0,
    meanHr: null as number | null,
    meanPaceSecPerKm: null as number | null,
    meanSpeedMps: null as number | null,
    efficiencySpeedPerHr: null as number | null,
  };
}

function summarizeHalf(
  rows: Array<{ hr: number; pace: number; speedMps: number }>
) {
  const meanHr = mean(rows.map((r) => r.hr));
  const meanPace = mean(rows.map((r) => r.pace));
  const meanSpeed = mean(rows.map((r) => r.speedMps));
  return {
    sampleCount: rows.length,
    meanHr: meanHr != null ? Number(meanHr.toFixed(1)) : null,
    meanPaceSecPerKm: meanPace != null ? Number(meanPace.toFixed(1)) : null,
    meanSpeedMps: meanSpeed != null ? Number(meanSpeed.toFixed(3)) : null,
    efficiencySpeedPerHr:
      meanHr != null && meanSpeed != null && meanHr > 0
        ? Number((meanSpeed / meanHr).toFixed(6))
        : null,
  };
}

export async function getAerobicDecoupling(params?: {
  days?: number;
  activityId?: string;
}) {
  await connectMongo();
  const days = Math.min(90, Math.max(7, params?.days ?? 28));
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - days);
  from.setUTCHours(0, 0, 0, 0);

  const filter: Record<string, unknown> = {
    activityType: "running",
    startedAt: { $gte: from },
  };
  if (params?.activityId) {
    filter._id = params.activityId;
  }

  const activities = await Activity.find(filter).sort({ startedAt: -1 }).lean();
  const details = await ActivityDetail.find({
    activityId: { $in: activities.map((a) => a._id) },
  }).lean();
  const detailById = new Map(details.map((d) => [String(d.activityId), d]));

  const sessions = [];
  for (const a of activities) {
    const detail = detailById.get(String(a._id));
    const samples = (detail?.samples ?? []) as SamplePoint[];
    const result = calculateDecoupling(samples);
    sessions.push({
      activityId: String(a._id),
      activityName: a.activityName,
      startedAt: new Date(a.startedAt).toISOString(),
      distanceMeters: a.distanceMeters ?? null,
      durationSeconds: a.durationSeconds ?? null,
      ...result,
    });
  }

  const eligible = sessions.filter((s) => s.eligible && s.decouplingPercent != null);
  const status =
    eligible.length >= 2
      ? ("ready" as const)
      : eligible.length === 1
        ? ("limited" as const)
        : ("insufficient_data" as const);

  const trend =
    eligible.length >= 2
      ? eligible
          .slice()
          .reverse()
          .map((s) => ({
            activityId: s.activityId,
            startedAt: s.startedAt,
            decouplingPercent: s.decouplingPercent,
          }))
      : [];

  return {
    available: eligible.length > 0,
    status,
    calculationVersion: CALCULATION_VERSION,
    method: METHOD,
    sourceLabel:
      "Paired Garmin chart samples (HR + pace). Half-split speed/HR efficiency.",
    limitations: [
      "Not a medical or definitive fitness test.",
      "Warm-up/cool-down trimmed by first/last 5% of paired samples only.",
      "Terrain, heat, and fueling confound drift — descriptive only.",
      "Whole-activity average HR+pace alone is never used.",
    ],
    windowDays: days,
    thresholds: {
      minPairedSamples: MIN_PAIRED_SAMPLES,
      minDurationSeconds: MIN_DURATION_SECONDS,
      edgeTrimFraction: EDGE_TRIM_FRACTION,
    },
    eligibleCount: eligible.length,
    ineligibleCount: sessions.length - eligible.length,
    sessions,
    trend,
    explanation:
      status === "insufficient_data"
        ? "Need sustained runs with stored HR+pace samples before decoupling can be shown."
        : status === "limited"
          ? "One eligible session — trends need more qualifying runs."
          : "Half-split aerobic decoupling for qualifying steady-ish efforts.",
    evaluatedAt: new Date().toISOString(),
  };
}
