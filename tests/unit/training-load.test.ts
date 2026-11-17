import { describe, expect, it } from "vitest";
import {
  buildEwmaSeries,
  detectRapidChange,
  extractGarminTrainingEffect,
  percentileRank,
  zoneWeightedLoad,
  ZONE_WEIGHTS,
} from "@/modules/training-load/service";

describe("zoneWeightedLoad", () => {
  it("applies Edwards weights to zone seconds", () => {
    const load = zoneWeightedLoad({
      z1: 60,
      z2: 120,
      z3: 0,
      z4: 0,
      z5: 0,
    });
    // 1 min * 1 + 2 min * 2 = 5
    expect(load).toBe(5);
    expect(ZONE_WEIGHTS.z5).toBe(5);
  });
});

describe("extractGarminTrainingEffect", () => {
  it("reads TE without inventing training load", () => {
    const te = extractGarminTrainingEffect({
      aerobicTrainingEffect: 2.4,
      anaerobicTrainingEffect: 0,
      trainingEffectLabel: "AEROBIC_BASE",
    });
    expect(te.aerobicTrainingEffect).toBe(2.4);
    expect(te.garminTrainingLoad).toBeNull();
  });

  it("captures Garmin training load when present", () => {
    expect(
      extractGarminTrainingEffect({ activityTrainingLoad: 180 })
        .garminTrainingLoad
    ).toBe(180);
  });
});

describe("EWMA + rapid change", () => {
  it("builds rising acute load after a spike", () => {
    const series = buildEwmaSeries([0, 0, 0, 0, 0, 0, 20], 7);
    expect(series[series.length - 1]).toBeGreaterThan(series[0]);
  });

  it("flags rapid 7-day swings", () => {
    const hit = detectRapidChange(40, 20, 0.3);
    expect(hit.triggered).toBe(true);
    expect(hit.direction).toBe("up");
    expect(hit.changeFraction).toBe(1);
  });

  it("ranks current load in own history", () => {
    expect(percentileRank(30, [10, 20, 30, 40])).toBe(50);
  });
});
