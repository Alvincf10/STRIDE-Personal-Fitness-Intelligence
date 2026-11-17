import { describe, expect, it } from "vitest";
import {
  evaluatePaceProgression,
  evaluateWeeklyVolume,
  evaluateZone2Consistency,
} from "../../src/modules/recommendations/rules";

describe("evaluateWeeklyVolume", () => {
  it("returns insufficient_data when previous week is zero", () => {
    const result = evaluateWeeklyVolume(10, 0);
    expect(result.status).toBe("insufficient_data");
  });

  it("returns insufficient_data when previous week is too small to compare", () => {
    const result = evaluateWeeklyVolume(9.35, 0.03);
    expect(result.status).toBe("insufficient_data");
  });

  it("triggers when increase exceeds threshold", () => {
    const result = evaluateWeeklyVolume(30, 20, 20);
    expect(result.status).toBe("triggered");
  });

  it("does not trigger within threshold", () => {
    const result = evaluateWeeklyVolume(22, 20, 20);
    expect(result.status).toBe("not_triggered");
  });
});

describe("evaluateZone2Consistency", () => {
  it("returns insufficient_data without samples", () => {
    const result = evaluateZone2Consistency({});
    expect(result.status).toBe("insufficient_data");
  });
});

describe("evaluatePaceProgression", () => {
  it("triggers on meaningful improvement", () => {
    const result = evaluatePaceProgression({
      recentPaceSecPerKm: 300,
      baselinePaceSecPerKm: 330,
      improvementPercent: 3,
    });
    expect(result.status).toBe("triggered");
  });
});
