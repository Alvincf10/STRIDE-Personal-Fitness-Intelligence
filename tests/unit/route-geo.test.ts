import { describe, expect, it } from "vitest";
import {
  extractRouteFromPayload,
  routeToSvgPath,
} from "@/modules/activities/route-geo";

describe("route-geo", () => {
  it("extracts start/end from Garmin summary fields", () => {
    const result = extractRouteFromPayload({
      startLatitude: -6.2,
      startLongitude: 106.8,
      endLatitude: -6.21,
      endLongitude: 106.81,
    });
    expect(result.source).toBe("start_end");
    expect(result.points).toHaveLength(2);
  });

  it("builds an svg path for two or more points", () => {
    const svg = routeToSvgPath([
      { lat: -6.2, lon: 106.8 },
      { lat: -6.21, lon: 106.81 },
    ]);
    expect(svg?.path.startsWith("M")).toBe(true);
    expect(svg?.start).toBeTruthy();
    expect(svg?.end).toBeTruthy();
  });
});
