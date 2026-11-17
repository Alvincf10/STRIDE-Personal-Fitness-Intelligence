import { connectMongo } from "@/lib/database/mongoose";
import { Activity } from "@/models";
import {
  extractGarminZoneSeconds,
  type ZoneSeconds,
} from "@/modules/hr-zones/service";

/** Edwards-style zone weights (minutes × weight). Documented STRIDE method. */
export const ZONE_WEIGHTS = {
  z1: 1,
  z2: 2,
  z3: 3,
  z4: 4,
  z5: 5,
} as const;

export const CALCULATION_VERSION = "1.0.0";
export const METHOD = "edwards_zone_weighted_minutes";

/** Configurable rapid-change threshold (fraction). */
export const RAPID_CHANGE_THRESHOLD = 0.3;

export const ATL_TAU_DAYS = 7;
export const CTL_TAU_DAYS = 42;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayStartUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * STRIDE Estimated Load from Garmin hrTimeInZone_* summaries.
 * Units: Edwards TRIMP-like score (zone-minutes × 1..5).
 */
export function zoneWeightedLoad(zones: ZoneSeconds): number {
  const minutes = (s: number) => s / 60;
  const load =
    minutes(zones.z1) * ZONE_WEIGHTS.z1 +
    minutes(zones.z2) * ZONE_WEIGHTS.z2 +
    minutes(zones.z3) * ZONE_WEIGHTS.z3 +
    minutes(zones.z4) * ZONE_WEIGHTS.z4 +
    minutes(zones.z5) * ZONE_WEIGHTS.z5;
  return Number(load.toFixed(2));
}

export function extractGarminTrainingEffect(
  rawPayload: Record<string, unknown> | null | undefined
): {
  aerobicTrainingEffect: number | null;
  anaerobicTrainingEffect: number | null;
  trainingEffectLabel: string | null;
  garminTrainingLoad: number | null;
} {
  const raw = asRecord(rawPayload) ?? {};
  const aerobic = asNumber(raw.aerobicTrainingEffect) ?? null;
  const anaerobic = asNumber(raw.anaerobicTrainingEffect) ?? null;
  const label =
    typeof raw.trainingEffectLabel === "string"
      ? raw.trainingEffectLabel
      : null;
  // Garmin numeric Training Load if ever present — never merge into STRIDE load.
  const garminLoad =
    asNumber(raw.activityTrainingLoad) ??
    asNumber(raw.trainingLoad) ??
    asNumber(raw.trainingLoadPeak) ??
    null;
  return {
    aerobicTrainingEffect: aerobic,
    anaerobicTrainingEffect: anaerobic,
    trainingEffectLabel: label,
    garminTrainingLoad: garminLoad,
  };
}

export function ewmaStep(
  previous: number,
  todayLoad: number,
  tauDays: number
): number {
  const alpha = 1 - Math.exp(-1 / tauDays);
  return previous + (todayLoad - previous) * alpha;
}

export function buildEwmaSeries(
  dailyLoads: number[],
  tauDays: number,
  initial = 0
): number[] {
  let value = initial;
  return dailyLoads.map((load) => {
    value = ewmaStep(value, load, tauDays);
    return Number(value.toFixed(3));
  });
}

export function sumWindow(values: number[], endIndexInclusive: number, window: number) {
  const start = Math.max(0, endIndexInclusive - window + 1);
  let sum = 0;
  for (let i = start; i <= endIndexInclusive; i++) sum += values[i] ?? 0;
  return Number(sum.toFixed(2));
}

export function percentileRank(value: number, population: number[]): number | null {
  if (!population.length) return null;
  const below = population.filter((v) => v < value).length;
  return Number(((below / population.length) * 100).toFixed(1));
}

export function detectRapidChange(
  recent: number,
  previous: number,
  threshold = RAPID_CHANGE_THRESHOLD
): {
  triggered: boolean;
  direction: "up" | "down" | "flat";
  changeFraction: number | null;
  threshold: number;
} {
  if (previous <= 0 && recent <= 0) {
    return {
      triggered: false,
      direction: "flat",
      changeFraction: 0,
      threshold,
    };
  }
  if (previous <= 0) {
    return {
      triggered: recent > 0,
      direction: "up",
      changeFraction: null,
      threshold,
    };
  }
  const changeFraction = (recent - previous) / previous;
  const direction =
    changeFraction > 0.02 ? "up" : changeFraction < -0.02 ? "down" : "flat";
  return {
    triggered: Math.abs(changeFraction) >= threshold,
    direction,
    changeFraction: Number(changeFraction.toFixed(3)),
    threshold,
  };
}

type ActivityLean = {
  _id: unknown;
  activityName?: string;
  startedAt: Date;
  activityType: string;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  averageHeartRateBpm?: number | null;
  rawPayload?: unknown;
};

export type DailyLoadPoint = {
  date: string;
  activityCount: number;
  durationSeconds: number;
  distanceMeters: number;
  strideEstimatedLoad: number | null;
  strideLoadMethod: string | null;
  missingHrReason: string | null;
  garminTrainingLoadSum: number | null;
  garminAerobicTeMax: number | null;
  garminAnaerobicTeMax: number | null;
};

function activityContribution(a: ActivityLean): {
  durationSeconds: number;
  distanceMeters: number;
  strideEstimatedLoad: number | null;
  strideLoadMethod: string | null;
  missingHrReason: string | null;
  garminTrainingLoad: number | null;
  aerobicTe: number | null;
  anaerobicTe: number | null;
} {
  const raw = asRecord(a.rawPayload);
  const zones = extractGarminZoneSeconds(raw);
  const te = extractGarminTrainingEffect(raw);
  const durationSeconds =
    typeof a.durationSeconds === "number" && Number.isFinite(a.durationSeconds)
      ? a.durationSeconds
      : 0;
  const distanceMeters =
    typeof a.distanceMeters === "number" && Number.isFinite(a.distanceMeters)
      ? a.distanceMeters
      : 0;

  const zoneTotal =
    zones == null
      ? 0
      : zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5;

  if (zones && zoneTotal > 0) {
    return {
      durationSeconds,
      distanceMeters,
      strideEstimatedLoad: zoneWeightedLoad(zones),
      strideLoadMethod: METHOD,
      missingHrReason: null,
      garminTrainingLoad: te.garminTrainingLoad,
      aerobicTe: te.aerobicTrainingEffect,
      anaerobicTe: te.anaerobicTrainingEffect,
    };
  }

  return {
    durationSeconds,
    distanceMeters,
    strideEstimatedLoad: null,
    strideLoadMethod: null,
    missingHrReason: zones
      ? "Garmin zone summaries are all zero for this activity."
      : "No Garmin hrTimeInZone_* on activity — HR-based STRIDE load not calculated.",
    garminTrainingLoad: te.garminTrainingLoad,
    aerobicTe: te.aerobicTrainingEffect,
    anaerobicTe: te.anaerobicTrainingEffect,
  };
}

export async function getTrainingLoad(params?: { days?: number }) {
  await connectMongo();
  const windowDays = Math.min(90, Math.max(28, params?.days ?? 42));
  // Need CTL warm-up beyond the display window.
  const historyDays = Math.max(windowDays + CTL_TAU_DAYS, 90);
  const from = dayStartUtc(addDays(new Date(), -historyDays));

  const activities = (await Activity.find({
    startedAt: { $gte: from },
  })
    .sort({ startedAt: 1 })
    .lean()) as ActivityLean[];

  const running = activities.filter((a) => a.activityType === "running");
  const nonRunning = activities.filter((a) => a.activityType !== "running");

  const today = dayStartUtc(new Date());
  const seriesStart = dayStartUtc(addDays(today, -(historyDays - 1)));
  const dayKeys: string[] = [];
  for (let d = new Date(seriesStart); d <= today; d = addDays(d, 1)) {
    dayKeys.push(utcDayKey(d));
  }

  const byDay = new Map<string, DailyLoadPoint>();
  for (const key of dayKeys) {
    byDay.set(key, {
      date: key,
      activityCount: 0,
      durationSeconds: 0,
      distanceMeters: 0,
      strideEstimatedLoad: null,
      strideLoadMethod: null,
      missingHrReason: null,
      garminTrainingLoadSum: null,
      garminAerobicTeMax: null,
      garminAnaerobicTeMax: null,
    });
  }

  const activityRows: Array<{
    id: string;
    activityName?: string;
    startedAt: string;
    activityType: string;
    durationSeconds: number;
    distanceMeters: number;
    strideEstimatedLoad: number | null;
    strideLoadMethod: string | null;
    missingHrReason: string | null;
    garmin: ReturnType<typeof extractGarminTrainingEffect>;
  }> = [];

  for (const a of running) {
    const contrib = activityContribution(a);
    const key = utcDayKey(new Date(a.startedAt));
    const day = byDay.get(key);
    if (day) {
      day.activityCount += 1;
      day.durationSeconds += contrib.durationSeconds;
      day.distanceMeters += contrib.distanceMeters;
      if (contrib.strideEstimatedLoad != null) {
        day.strideEstimatedLoad =
          (day.strideEstimatedLoad ?? 0) + contrib.strideEstimatedLoad;
        day.strideLoadMethod = METHOD;
        day.missingHrReason = null;
      } else if (day.strideEstimatedLoad == null && day.activityCount > 0) {
        day.missingHrReason = contrib.missingHrReason;
      }
      if (contrib.garminTrainingLoad != null) {
        day.garminTrainingLoadSum =
          (day.garminTrainingLoadSum ?? 0) + contrib.garminTrainingLoad;
      }
      if (contrib.aerobicTe != null) {
        day.garminAerobicTeMax = Math.max(
          day.garminAerobicTeMax ?? 0,
          contrib.aerobicTe
        );
      }
      if (contrib.anaerobicTe != null) {
        day.garminAnaerobicTeMax = Math.max(
          day.garminAnaerobicTeMax ?? 0,
          contrib.anaerobicTe
        );
      }
    }

    activityRows.push({
      id: String(a._id),
      activityName: a.activityName,
      startedAt: new Date(a.startedAt).toISOString(),
      activityType: a.activityType,
      durationSeconds: contrib.durationSeconds,
      distanceMeters: contrib.distanceMeters,
      strideEstimatedLoad: contrib.strideEstimatedLoad,
      strideLoadMethod: contrib.strideLoadMethod,
      missingHrReason: contrib.missingHrReason,
      garmin: extractGarminTrainingEffect(asRecord(a.rawPayload)),
    });
  }

  // Round daily STRIDE loads
  for (const day of byDay.values()) {
    if (day.strideEstimatedLoad != null) {
      day.strideEstimatedLoad = Number(day.strideEstimatedLoad.toFixed(2));
    }
    day.durationSeconds = Number(day.durationSeconds.toFixed(1));
    day.distanceMeters = Number(day.distanceMeters.toFixed(1));
  }

  const ordered = dayKeys.map((k) => byDay.get(k)!);
  // For EWMA: treat missing HR load as 0 only on days with no eligible zone load.
  // Days with activities but no HR stay null for display; EWMA uses 0 with a flag.
  const loadForEwma = ordered.map((d) => d.strideEstimatedLoad ?? 0);
  const atl = buildEwmaSeries(loadForEwma, ATL_TAU_DAYS);
  const ctl = buildEwmaSeries(loadForEwma, CTL_TAU_DAYS);
  const formSeries = atl.map((a, i) => Number((ctl[i] - a).toFixed(3)));

  const lastIdx = ordered.length - 1;
  const displayFromIdx = Math.max(0, ordered.length - windowDays);
  const display = ordered.slice(displayFromIdx).map((d, i) => {
    const idx = displayFromIdx + i;
    return {
      ...d,
      acuteLoad: atl[idx],
      chronicLoad: ctl[idx],
      formScore: formSeries[idx],
    };
  });

  const load7 = sumWindow(loadForEwma, lastIdx, 7);
  const load28 = sumWindow(loadForEwma, lastIdx, 28);
  const prev7 = sumWindow(loadForEwma, lastIdx - 7, 7);
  const duration7 = sumWindow(
    ordered.map((d) => d.durationSeconds),
    lastIdx,
    7
  );
  const duration28 = sumWindow(
    ordered.map((d) => d.durationSeconds),
    lastIdx,
    28
  );
  const distance7 = sumWindow(
    ordered.map((d) => d.distanceMeters),
    lastIdx,
    7
  );
  const distance28 = sumWindow(
    ordered.map((d) => d.distanceMeters),
    lastIdx,
    28
  );

  // Rolling 7-day load population for historical range (own history only).
  const rolling7: number[] = [];
  for (let i = 6; i < loadForEwma.length; i++) {
    rolling7.push(sumWindow(loadForEwma, i, 7));
  }
  const historical = {
    rolling7DayLoads: rolling7,
    current7DayPercentile: percentileRank(load7, rolling7),
    min7: rolling7.length ? Math.min(...rolling7) : null,
    max7: rolling7.length ? Math.max(...rolling7) : null,
    median7: (() => {
      if (!rolling7.length) return null;
      const s = [...rolling7].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : Number(((s[mid - 1] + s[mid]) / 2).toFixed(2));
    })(),
  };

  const rapid = detectRapidChange(load7, prev7);

  const withZoneLoad = activityRows.filter((r) => r.strideEstimatedLoad != null);
  const withoutZoneLoad = activityRows.filter(
    (r) => r.strideEstimatedLoad == null
  );
  const garminTeCount = activityRows.filter(
    (r) =>
      r.garmin.aerobicTrainingEffect != null ||
      r.garmin.garminTrainingLoad != null
  ).length;

  const status =
    withZoneLoad.length >= 3
      ? ("ready" as const)
      : withZoneLoad.length > 0
        ? ("limited" as const)
        : activityRows.length > 0
          ? ("insufficient_data" as const)
          : ("insufficient_data" as const);

  const acuteChronicRatio =
    ctl[lastIdx] > 0
      ? Number((atl[lastIdx] / ctl[lastIdx]).toFixed(2))
      : null;

  return {
    available: withZoneLoad.length > 0,
    status,
    calculationVersion: CALCULATION_VERSION,
    method: METHOD,
    sourceLabel:
      "STRIDE Estimated Load from Garmin hrTimeInZone_* (Edwards zone-weighted minutes)",
    label: "STRIDE Estimated Load",
    limitations: [
      "Not Garmin Training Load — Garmin TE / Training Load shown separately and never merged.",
      "Acute:chronic ratio is descriptive only — not an injury predictor.",
      "Days with no stored activities show zero volume; sync gaps can look like rest days.",
      "Non-running sports are counted in activity inventory but excluded from running load.",
    ],
    windowDays,
    historyDays,
    thresholds: {
      rapidChangeFraction: RAPID_CHANGE_THRESHOLD,
      atlTauDays: ATL_TAU_DAYS,
      ctlTauDays: CTL_TAU_DAYS,
    },
    volume: {
      last7Days: {
        durationSeconds: duration7,
        distanceMeters: distance7,
        strideEstimatedLoad: load7,
      },
      last28Days: {
        durationSeconds: duration28,
        distanceMeters: distance28,
        strideEstimatedLoad: load28,
      },
      previous7Days: {
        strideEstimatedLoad: prev7,
      },
    },
    impulseResponse: {
      acuteLoad: atl[lastIdx],
      chronicLoad: ctl[lastIdx],
      formScore: formSeries[lastIdx],
      acuteChronicRatio,
      note: "Form = chronic − acute (Banister-style EWMA). Descriptive fitness/fatigue proxy only.",
    },
    historicalRange: historical,
    rapidChange: {
      ...rapid,
      recent7DayLoad: load7,
      previous7DayLoad: prev7,
      explanation: rapid.triggered
        ? `7-day STRIDE load moved ${rapid.direction} beyond ±${Math.round(RAPID_CHANGE_THRESHOLD * 100)}% vs the prior 7 days.`
        : "No material 7-day load swing vs the prior week at the configured threshold.",
    },
    coverage: {
      runningActivityCount: running.length,
      nonRunningActivityCount: nonRunning.length,
      withStrideLoad: withZoneLoad.length,
      withoutStrideLoad: withoutZoneLoad.length,
      withGarminTeOrLoad: garminTeCount,
    },
    daily: display,
    recentActivities: activityRows.slice(-20).reverse(),
    explanation:
      status === "insufficient_data"
        ? "Need running activities with Garmin hrTimeInZone_* before STRIDE Estimated Load can be shown."
        : status === "limited"
          ? "Some zone-weighted loads exist, but history is thin — trends stay low-confidence."
          : "Daily STRIDE Estimated Load with Banister-style acute/chronic EWMA from your own zone summaries.",
    evaluatedAt: new Date().toISOString(),
  };
}
