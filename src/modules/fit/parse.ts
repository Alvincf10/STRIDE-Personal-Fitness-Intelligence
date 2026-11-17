import FitParser from "fit-file-parser";
import JSZip from "jszip";

export const FIT_PARSER_VERSION = "1.0.0-fit-file-parser";

export type FitParsedSample = {
  timestamp: Date;
  heartRateBpm?: number;
  paceSecPerKm?: number;
  cadenceSpm?: number;
  altitudeMeters?: number;
};

export type FitParsedLap = {
  lapNumber: number;
  distanceMeters?: number;
  durationSeconds?: number;
  averagePaceSecPerKm?: number;
  averageHeartRateBpm?: number;
};

export type FitParseResult = {
  samples: FitParsedSample[];
  routePoints: Array<{
    lat: number;
    lon: number;
    altitudeMeters?: number;
    timestamp?: Date;
  }>;
  laps: FitParsedLap[];
  recordCount: number;
  lapCount: number;
};

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Garmin semicircles → degrees when values look like semicircles. */
function toDegrees(value: number | undefined): number | undefined {
  if (value == null) return undefined;
  if (Math.abs(value) <= 180) return value;
  return (value * 180) / 2 ** 31;
}

export async function extractFitBufferFromZip(zipBuf: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(zipBuf);
  const name = Object.keys(zip.files).find((n) =>
    n.toLowerCase().endsWith(".fit")
  );
  if (!name) throw new Error("ZIP has no .fit entry");
  const file = zip.file(name);
  if (!file) throw new Error("FIT entry unreadable");
  return Buffer.from(await file.async("uint8array"));
}

export async function parseFitBuffer(fitBuf: Buffer): Promise<FitParseResult> {
  const parser = new FitParser({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    temperatureUnit: "celsius",
    elapsedRecordField: true,
  });

  const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
    parser.parse(fitBuf, (err: Error | undefined, parsed: unknown) => {
      if (err) reject(err);
      else resolve((parsed ?? {}) as Record<string, unknown>);
    });
  });

  const records = Array.isArray(data.records) ? data.records : [];
  const lapsRaw = Array.isArray(data.laps) ? data.laps : [];

  const samples: FitParsedSample[] = [];
  const routePoints: FitParseResult["routePoints"] = [];

  for (const row of records) {
    const r = row as Record<string, unknown>;
    const tsRaw = r.timestamp;
    const timestamp =
      tsRaw instanceof Date
        ? tsRaw
        : typeof tsRaw === "string" || typeof tsRaw === "number"
          ? new Date(tsRaw)
          : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) continue;

    const speed =
      asNumber(r.enhanced_speed) ?? asNumber(r.speed) ?? undefined;
    const cadenceOneFoot = asNumber(r.cadence);
    const fractional = asNumber(r.fractional_cadence) ?? 0;
    const cadenceSpm =
      cadenceOneFoot != null
        ? Number(((cadenceOneFoot + fractional) * 2).toFixed(1))
        : undefined;

    samples.push({
      timestamp,
      heartRateBpm: asNumber(r.heart_rate),
      paceSecPerKm:
        speed != null && speed > 0.3
          ? Number((1000 / speed).toFixed(2))
          : undefined,
      cadenceSpm,
      altitudeMeters:
        asNumber(r.enhanced_altitude) ?? asNumber(r.altitude) ?? undefined,
    });

    const lat = toDegrees(
      asNumber(r.position_lat) ?? asNumber(r.positionLat)
    );
    const lon = toDegrees(
      asNumber(r.position_long) ?? asNumber(r.positionLong)
    );
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      routePoints.push({
        lat,
        lon,
        altitudeMeters:
          asNumber(r.enhanced_altitude) ?? asNumber(r.altitude) ?? undefined,
        timestamp,
      });
    }
  }

  const laps: FitParsedLap[] = lapsRaw.map((lap, index) => {
    const l = lap as Record<string, unknown>;
    const distance = asNumber(l.total_distance);
    const duration =
      asNumber(l.total_timer_time) ?? asNumber(l.total_elapsed_time);
    const avgSpeed =
      asNumber(l.enhanced_avg_speed) ?? asNumber(l.avg_speed);
    return {
      lapNumber: index + 1,
      distanceMeters: distance,
      durationSeconds: duration,
      averagePaceSecPerKm:
        avgSpeed != null && avgSpeed > 0.3
          ? Number((1000 / avgSpeed).toFixed(2))
          : distance && duration && distance > 0
            ? Number((duration / (distance / 1000)).toFixed(2))
            : undefined,
      averageHeartRateBpm: asNumber(l.avg_heart_rate),
    };
  });

  return {
    samples,
    routePoints,
    laps,
    recordCount: samples.length,
    lapCount: laps.length,
  };
}
