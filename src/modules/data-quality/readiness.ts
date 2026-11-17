import type {
  FeatureReadiness,
  FeatureReadinessStatus,
} from "@/modules/data-quality/types";
import { getDataCoverage } from "@/modules/data-quality/coverage";

function statusFrom(
  available: string[],
  required: string[],
  sampleCount: number,
  minimumSampleCount: number
): FeatureReadinessStatus {
  const missing = required.filter((m) => !available.includes(m));
  if (missing.length === required.length) {
    return sampleCount === 0 ? "not_synced" : "insufficient_data";
  }
  if (missing.length > 0 || sampleCount < minimumSampleCount) {
    return sampleCount === 0 ? "insufficient_data" : "limited";
  }
  return "ready";
}

export async function getFeatureReadiness(): Promise<FeatureReadiness[]> {
  const coverage = await getDataCoverage();
  const available = coverage.metrics
    .filter((m) => m.status === "available" || m.status === "partial")
    .map((m) => m.metricKey);
  const count = (key: string) =>
    coverage.metrics.find((m) => m.metricKey === key)?.recordCount ?? 0;
  const now = new Date().toISOString();

  const specs: Array<{
    featureId: string;
    label: string;
    required: string[];
    minimum: number;
    sampleKey: string;
    explanations: Record<FeatureReadinessStatus, string>;
  }> = [
    {
      featureId: "recovery",
      label: "Recovery Intelligence",
      required: ["daily.rhr", "daily.hrv", "daily.sleep"],
      minimum: 7,
      sampleKey: "daily.rhr",
      explanations: {
        ready: "Enough recovery signals for personal comparison.",
        limited: "Some recovery signals exist, but coverage is thin.",
        insufficient_data: "Need more RHR/HRV/sleep days before recovery status is meaningful.",
        not_supported: "Recovery metrics are not supported for this account.",
        not_synced: "Health data has not been synced into daily metrics yet.",
        error: "Recovery readiness could not be evaluated.",
      },
    },
    {
      featureId: "coach",
      label: "Smart Running Coach",
      required: ["activities.running"],
      minimum: 1,
      sampleKey: "activities.running",
      explanations: {
        ready: "Coach can use recent runs and available recovery signals.",
        limited: "Coach works with limited history; confidence stays lower.",
        insufficient_data: "Need at least one synced run for coach suggestions.",
        not_supported: "Coach inputs are unavailable.",
        not_synced: "No activities synced yet.",
        error: "Coach readiness could not be evaluated.",
      },
    },
    {
      featureId: "hr_zones",
      label: "HR Zone Intelligence",
      required: ["activities.hr_zone_summary"],
      minimum: 1,
      sampleKey: "activities.hr_zone_summary",
      explanations: {
        ready: "Garmin hrTimeInZone_* summaries are available.",
        limited: "Only some runs include Garmin zone-time summaries.",
        insufficient_data:
          "No Garmin zone summaries. Average/max HR alone cannot invent time-in-zone.",
        not_supported: "Zone summaries are not available for this account/device path.",
        not_synced: "Activities with zone summaries have not been synced.",
        error: "HR zone readiness could not be evaluated.",
      },
    },
    {
      featureId: "aerobic_efficiency",
      label: "Aerobic Efficiency",
      required: ["activities.hr_average", "activities.running"],
      minimum: 3,
      sampleKey: "activities.hr_average",
      explanations: {
        ready: "Enough runs with average HR for pace-at-effort bands.",
        limited: "Some HR-linked runs exist, but below preferred sample threshold.",
        insufficient_data:
          "Need multiple runs ≥ 3 km with average HR before efficiency bands.",
        not_supported: "Required HR fields are not supported.",
        not_synced: "No activities with average HR synced.",
        error: "Aerobic efficiency readiness could not be evaluated.",
      },
    },
    {
      featureId: "training_load",
      label: "Advanced Training Load",
      required: ["activities.running", "activities.hr_zone_summary"],
      minimum: 3,
      sampleKey: "activities.hr_zone_summary",
      explanations: {
        ready: "Enough Garmin zone summaries for STRIDE Estimated Load.",
        limited:
          "Some zone summaries exist; volume still shows, but HR-load confidence is thin.",
        insufficient_data:
          "Need runs with hrTimeInZone_* before STRIDE Estimated Load (Edwards).",
        not_supported: "Training load inputs unavailable.",
        not_synced: "No activities with zone summaries synced.",
        error: "Training load readiness could not be evaluated.",
      },
    },
    {
      featureId: "aerobic_decoupling",
      label: "Aerobic Decoupling",
      required: ["activities.hr_samples", "activities.running"],
      minimum: 1,
      sampleKey: "activities.hr_samples",
      explanations: {
        ready: "HR+pace chart samples available for half-split decoupling.",
        limited: "Some sample coverage exists; need sustained paired HR+pace.",
        insufficient_data:
          "Need Garmin /activity/details samples before decoupling.",
        not_supported: "Sample charts unavailable for this account path.",
        not_synced: "Activity chart samples have not been enriched yet.",
        error: "Decoupling readiness could not be evaluated.",
      },
    },
    {
      featureId: "energy_timeline",
      label: "Energy & Stress Timeline",
      required: ["daily.body_battery", "daily.stress"],
      minimum: 1,
      sampleKey: "daily.body_battery",
      explanations: {
        ready: "Intraday/daily energy signals are populated.",
        limited: "Only one of Body Battery or stress is populated.",
        insufficient_data:
          "No Body Battery/stress series stored yet. Endpoint may succeed while user data is empty.",
        not_supported: "Intraday wellness series not supported.",
        not_synced: "Health sync has not stored wellness series.",
        error: "Energy timeline readiness could not be evaluated.",
      },
    },
    {
      featureId: "daily_movement",
      label: "Daily Movement",
      required: ["daily.steps"],
      minimum: 3,
      sampleKey: "daily.steps",
      explanations: {
        ready: "Enough step days for movement trends.",
        limited: "Some step days exist.",
        insufficient_data: "No step days stored from health sync.",
        not_supported: "Steps not available.",
        not_synced: "Health sync has not stored steps.",
        error: "Daily movement readiness could not be evaluated.",
      },
    },
  ];

  return specs.map((spec) => {
    const sampleCount = count(spec.sampleKey);
    const availableMetrics = spec.required.filter((m) => available.includes(m));
    const missingMetrics = spec.required.filter((m) => !available.includes(m));
    const status = statusFrom(
      available,
      spec.required,
      sampleCount,
      spec.minimum
    );
    const coverageRatio =
      spec.required.length === 0
        ? null
        : Number((availableMetrics.length / spec.required.length).toFixed(2));

    return {
      featureId: spec.featureId,
      label: spec.label,
      status,
      requiredMetrics: spec.required,
      availableMetrics,
      missingMetrics,
      sampleCount,
      minimumSampleCount: spec.minimum,
      coverage: coverageRatio,
      evaluatedAt: now,
      explanation: spec.explanations[status],
    };
  });
}
