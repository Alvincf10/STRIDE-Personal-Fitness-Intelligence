import { getCapabilityMatrix } from "@/modules/data-quality/capabilities";
import { getDataCoverage } from "@/modules/data-quality/coverage";
import { getFeatureReadiness } from "@/modules/data-quality/readiness";
import { getSyncHealth } from "@/modules/data-quality/sync-health";

export async function getDataQualityOverview() {
  const [syncHealth, coverage, capabilities, readiness] = await Promise.all([
    getSyncHealth(),
    getDataCoverage(),
    getCapabilityMatrix(),
    getFeatureReadiness(),
  ]);

  const blockers = readiness.filter(
    (f) =>
      f.status === "insufficient_data" ||
      f.status === "not_synced" ||
      f.status === "error"
  );

  return {
    summary: {
      connectionStatus: syncHealth.connectionStatus,
      activitySyncStatus: syncHealth.activities.status,
      healthSyncStatus: syncHealth.health.status,
      lastActivitySyncAt: syncHealth.activities.lastSuccessfulAt,
      lastHealthSyncAt: syncHealth.health.lastSuccessfulAt,
      runningActivities: coverage.window.activityCount,
      dailyMetricDays: coverage.window.dailyMetricDays,
      hrSampleActivities: coverage.activityCoverage.withHrSamples,
      featuresReady: readiness.filter((f) => f.status === "ready").length,
      featuresLimited: readiness.filter((f) => f.status === "limited").length,
      featuresBlocked: blockers.length,
    },
    syncHealth,
    coverage,
    capabilities,
    readiness,
    topBlockers: blockers.slice(0, 5),
    evaluatedAt: new Date().toISOString(),
    calculationVersion: "1.0.0",
  };
}
