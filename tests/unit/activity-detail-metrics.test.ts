import { describe, expect, it } from "vitest";
import {
  buildActivityEvaluation,
  parseActivityDetailMetrics,
  parseSplitSummaries,
} from "@/modules/activities/detail-metrics";

describe("parseActivityDetailMetrics", () => {
  it("maps Garmin chart rows into HR/pace samples and track points", () => {
    const parsed = parseActivityDetailMetrics({
      metricDescriptors: [
        { metricsIndex: 0, key: "directSpeed" },
        { metricsIndex: 1, key: "directHeartRate" },
        { metricsIndex: 2, key: "directTimestamp" },
        { metricsIndex: 3, key: "directDoubleCadence" },
        { metricsIndex: 4, key: "directElevation" },
        { metricsIndex: 5, key: "directLatitude" },
        { metricsIndex: 6, key: "directLongitude" },
      ],
      activityDetailMetrics: [
        {
          metrics: [2.5, 150, 1_794_403_281_000, 160, 18, -6.21, 106.8],
        },
      ],
      geoPolylineDTO: {
        polyline: [
          { lat: -6.21, lon: 106.8, time: 1_794_403_281_000, valid: true },
          { lat: -6.211, lon: 106.801, time: 1_794_403_290_000, valid: true },
        ],
      },
    });
    expect(parsed.samples).toHaveLength(1);
    expect(parsed.samples[0].heartRateBpm).toBe(150);
    expect(parsed.samples[0].cadenceSpm).toBe(160);
    expect(parsed.samples[0].paceSecPerKm).toBeCloseTo(400, 0);
    expect(parsed.routeSource).toBe("garmin_track");
    expect(parsed.routePoints.length).toBe(2);
  });
});

describe("parseSplitSummaries + evaluation", () => {
  it("reads interval split summaries", () => {
    const laps = parseSplitSummaries({
      splitSummaries: [
        {
          splitType: "INTERVAL_WARMUP",
          distance: 400,
          duration: 180,
          averageSpeed: 2.22,
          averageHR: 130,
        },
      ],
    });
    expect(laps[0].splitType).toBe("INTERVAL_WARMUP");
    expect(laps[0].averageHeartRateBpm).toBe(130);
  });

  it("builds evaluation from Garmin summary without inventing Strava", () => {
    const ev = buildActivityEvaluation({
      source: "garmin",
      averageHeartRateBpm: 177,
      maxHeartRateBpm: 195,
      rawPayload: {
        hrTimeInZone_5: 100,
        hrTimeInZone_4: 50,
        hrTimeInZone_3: 0,
        hrTimeInZone_2: 0,
        hrTimeInZone_1: 0,
        aerobicTrainingEffect: 5,
        trainingEffectLabel: "VO2MAX",
        avgPower: 213,
      },
    });
    expect(ev.sourceLabel).toMatch(/not Strava/i);
    expect(ev.zones?.percents.z5).toBeGreaterThan(50);
    expect(ev.garminTrainingEffect.aerobicTrainingEffect).toBe(5);
    expect(ev.dynamics.avgPowerWatts).toBe(213);
  });
});
