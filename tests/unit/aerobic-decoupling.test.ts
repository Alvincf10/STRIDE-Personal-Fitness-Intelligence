import { describe, expect, it } from "vitest";
import { calculateDecoupling } from "@/modules/aerobic-decoupling/service";

function makeSamples(n: number, opts: { hrStart: number; hrDrift: number; pace: number }) {
  const start = Date.parse("2026-11-11T13:00:00.000Z");
  return Array.from({ length: n }, (_, i) => {
    const frac = i / Math.max(1, n - 1);
    return {
      timestamp: new Date(start + i * 10_000),
      heartRateBpm: opts.hrStart + opts.hrDrift * frac,
      paceSecPerKm: opts.pace,
    };
  });
}

describe("calculateDecoupling", () => {
  it("rejects too few paired samples", () => {
    const result = calculateDecoupling(
      makeSamples(10, { hrStart: 140, hrDrift: 10, pace: 360 })
    );
    expect(result.eligible).toBe(false);
    expect(result.ineligibleReason).toMatch(/paired/i);
  });

  it("flags positive decoupling when HR drifts at steady pace", () => {
    // 180 points × 15s ≈ 45 min span after trim.
    const start = Date.parse("2026-11-11T13:00:00.000Z");
    const samples = Array.from({ length: 180 }, (_, i) => {
      const frac = i / 179;
      return {
        timestamp: new Date(start + i * 15_000),
        heartRateBpm: 140 + 30 * frac,
        paceSecPerKm: 360,
      };
    });
    const result = calculateDecoupling(samples);
    expect(result.eligible).toBe(true);
    expect(result.decouplingPercent).not.toBeNull();
    expect(result.decouplingPercent!).toBeGreaterThan(0);
  });

  it("never invents a result from empty samples", () => {
    const result = calculateDecoupling([]);
    expect(result.eligible).toBe(false);
    expect(result.decouplingPercent).toBeNull();
  });
});
