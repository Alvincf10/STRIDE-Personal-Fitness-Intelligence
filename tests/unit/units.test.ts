import { describe, expect, it } from "vitest";
import {
  formatDistance,
  formatPace,
  paceFromDistanceDuration,
} from "../../src/lib/utils/units";

describe("units", () => {
  it("formats missing distance as unavailable", () => {
    expect(formatDistance(undefined, "km")).toBe("Unavailable");
  });

  it("computes pace from distance and duration", () => {
    expect(paceFromDistanceDuration(5000, 1500)).toBe(300);
  });

  it("formats pace", () => {
    expect(formatPace(300, "min/km")).toBe("5:00 min/km");
  });
});
