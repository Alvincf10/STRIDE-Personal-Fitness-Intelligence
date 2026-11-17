import { connectMongo } from "@/lib/database/mongoose";
import { FeatureCapability } from "@/models";
import { getDataCoverage } from "@/modules/data-quality/coverage";
import type { AvailabilityStatus } from "@/modules/data-quality/types";

/**
 * Endpoint probe status is not the same as populated user data.
 * Map probe + coverage into PRD availability language.
 */
export async function getCapabilityMatrix() {
  await connectMongo();
  const [probes, coverage] = await Promise.all([
    FeatureCapability.find({ provider: "garmin" }).sort({ endpointKey: 1 }).lean(),
    getDataCoverage(),
  ]);

  const metricByEndpoint: Record<string, string[]> = {
    "activities.search": ["activities.running", "activities.hr_average", "activities.gps"],
    "daily.summaries": [
      "daily.rhr",
      "daily.steps",
      "daily.stress",
      "daily.body_battery",
    ],
    "sleep.summaries": ["daily.sleep"],
    "hrv.daily": ["daily.hrv"],
    "vo2max.daily": ["daily.vo2max"],
  };

  const items = probes.map((probe) => {
    const relatedKeys = metricByEndpoint[probe.endpointKey] ?? [];
    const related = coverage.metrics.filter((m) =>
      relatedKeys.includes(m.metricKey)
    );
    const populated = related.filter(
      (m) => m.status === "available" || m.status === "partial"
    ).length;
    const empty = related.filter((m) => m.status === "empty").length;

    let dataStatus: AvailabilityStatus = "not_synced";
    if (probe.status === "error" || probe.status === "unavailable") {
      dataStatus = probe.status === "error" ? "error" : "not_supported";
    } else if (related.length === 0) {
      dataStatus = probe.status === "available" ? "available" : "not_synced";
    } else if (populated === related.length) {
      dataStatus = "available";
    } else if (populated > 0) {
      dataStatus = "partial";
    } else if (empty === related.length) {
      // Endpoint probe succeeded but no user rows — not "available".
      dataStatus = "empty";
    }

    return {
      endpointKey: probe.endpointKey,
      label: probe.label,
      probeStatus: probe.status,
      dataStatus,
      lastCheckedAt: probe.lastCheckedAt?.toISOString() ?? null,
      lastSuccessAt: probe.lastSuccessAt?.toISOString() ?? null,
      sampleFields: (probe.sampleFields ?? []).slice(0, 12),
      relatedMetrics: related.map((m) => ({
        metricKey: m.metricKey,
        status: m.status,
        recordCount: m.recordCount,
      })),
      sanitizedNote:
        dataStatus === "empty"
          ? "Endpoint responds, but no populated user rows are stored yet."
          : probe.sanitizedNote ?? null,
    };
  });

  return {
    items,
    evaluatedAt: new Date().toISOString(),
  };
}
