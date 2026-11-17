import { describe, expect, it } from "vitest";
import { extractGarminZoneSeconds } from "@/modules/hr-zones/service";

describe("extractGarminZoneSeconds", () => {
  it("reads Garmin hrTimeInZone_* summaries", () => {
    const zones = extractGarminZoneSeconds({
      hrTimeInZone_1: 40,
      hrTimeInZone_2: 580,
      hrTimeInZone_3: 945,
      hrTimeInZone_4: 222,
      hrTimeInZone_5: 0,
    });
    expect(zones).toEqual({
      z1: 40,
      z2: 580,
      z3: 945,
      z4: 222,
      z5: 0,
    });
  });

  it("returns null when zone fields are absent", () => {
    expect(extractGarminZoneSeconds({ averageHR: 144 })).toBeNull();
  });
});
