import { describe, expect, it } from "vitest";

/**
 * Pure readiness helper mirrored from data-quality/readiness mapping rules.
 * Keeps threshold language stable without Mongo.
 */
function statusFrom(
  available: string[],
  required: string[],
  sampleCount: number,
  minimumSampleCount: number
) {
  const missing = required.filter((m) => !available.includes(m));
  if (missing.length === required.length) {
    return sampleCount === 0 ? "not_synced" : "insufficient_data";
  }
  if (missing.length > 0 || sampleCount < minimumSampleCount) {
    return sampleCount === 0 ? "insufficient_data" : "limited";
  }
  return "ready";
}

describe("feature readiness thresholds", () => {
  it("marks hr_zones insufficient without samples", () => {
    expect(
      statusFrom(["activities.running"], ["activities.hr_samples"], 0, 1)
    ).toBe("not_synced");
  });

  it("marks recovery limited when only some signals exist", () => {
    expect(
      statusFrom(
        ["daily.rhr"],
        ["daily.rhr", "daily.hrv", "daily.sleep"],
        3,
        7
      )
    ).toBe("limited");
  });

  it("marks coach ready with one run", () => {
    expect(statusFrom(["activities.running"], ["activities.running"], 4, 1)).toBe(
      "ready"
    );
  });
});
