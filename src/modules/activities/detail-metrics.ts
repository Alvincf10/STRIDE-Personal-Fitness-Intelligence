import { extractGarminZoneSeconds } from "@/modules/hr-zones/service";
import { extractGarminTrainingEffect } from "@/modules/training-load/service";
import type { RoutePoint } from "@/modules/activities/route-geo";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export type ParsedSample = {
  timestamp: Date;
  heartRateBpm?: number;
  paceSecPerKm?: number;
  cadenceSpm?: number;
  altitudeMeters?: number;
  speedMps?: number;
  powerWatts?: number;
};

export type ParsedLap = {
  lapNumber: number;
  distanceMeters?: number;
  durationSeconds?: number;
  averagePaceSecPerKm?: number;
  averageHeartRateBpm?: number;
  splitType?: string;
};

function descriptorIndex(
  descriptors: Array<Record<string, unknown>>,
  key: string
): number | null {
  const hit = descriptors.find((d) => d.key === key);
  const idx = asNumber(hit?.metricsIndex);
  return idx == null ? null : idx;
}

function metricAt(
  row: unknown[],
  index: number | null
): number | undefined {
  if (index == null) return undefined;
  return asNumber(row[index]);
}

/**
 * Parse Garmin `/activity-service/activity/{id}/details` charts into samples.
 */
export function parseActivityDetailMetrics(payload: unknown): {
  samples: ParsedSample[];
  routePoints: RoutePoint[];
  routeSource: "garmin_track" | "start_end" | "none";
  measurementCount: number;
  metricKeys: string[];
} {
  const root = asRecord(payload);
  if (!root) {
    return {
      samples: [],
      routePoints: [],
      routeSource: "none",
      measurementCount: 0,
      metricKeys: [],
    };
  }

  const descriptors = Array.isArray(root.metricDescriptors)
    ? (root.metricDescriptors as Array<Record<string, unknown>>)
    : [];
  const metricKeys = descriptors
    .map((d) => asString(d.key))
    .filter((k): k is string => !!k);

  const idx = {
    ts: descriptorIndex(descriptors, "directTimestamp"),
    hr: descriptorIndex(descriptors, "directHeartRate"),
    speed: descriptorIndex(descriptors, "directSpeed"),
    elev: descriptorIndex(descriptors, "directElevation"),
    runCadence: descriptorIndex(descriptors, "directRunCadence"),
    doubleCadence: descriptorIndex(descriptors, "directDoubleCadence"),
    lat: descriptorIndex(descriptors, "directLatitude"),
    lon: descriptorIndex(descriptors, "directLongitude"),
    power: descriptorIndex(descriptors, "directPower"),
  };

  const rows = Array.isArray(root.activityDetailMetrics)
    ? (root.activityDetailMetrics as Array<Record<string, unknown>>)
    : [];

  const samples: ParsedSample[] = [];
  const routeFromMetrics: RoutePoint[] = [];

  for (const rowObj of rows) {
    const metrics = Array.isArray(rowObj.metrics) ? rowObj.metrics : null;
    if (!metrics) continue;
    const tsMs = metricAt(metrics, idx.ts);
    if (tsMs == null) continue;
    const speed = metricAt(metrics, idx.speed);
    const doubleCadence = metricAt(metrics, idx.doubleCadence);
    const runCadence = metricAt(metrics, idx.runCadence);
    const cadenceSpm =
      doubleCadence ?? (runCadence != null ? runCadence * 2 : undefined);
    const sample: ParsedSample = {
      timestamp: new Date(tsMs),
      heartRateBpm: metricAt(metrics, idx.hr),
      altitudeMeters: metricAt(metrics, idx.elev),
      speedMps: speed,
      paceSecPerKm:
        speed != null && speed > 0.3 ? Number((1000 / speed).toFixed(2)) : undefined,
      cadenceSpm,
      powerWatts: metricAt(metrics, idx.power),
    };
    samples.push(sample);

    const lat = metricAt(metrics, idx.lat);
    const lon = metricAt(metrics, idx.lon);
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      routeFromMetrics.push({
        lat,
        lon,
        altitudeMeters: sample.altitudeMeters,
        timestamp: sample.timestamp,
      });
    }
  }

  const poly = asRecord(root.geoPolylineDTO);
  const polyRows = Array.isArray(poly?.polyline) ? poly!.polyline : [];
  const routeFromPoly: RoutePoint[] = [];
  for (const p of polyRows) {
    const row = asRecord(p);
    if (!row) continue;
    const lat = asNumber(row.lat);
    const lon = asNumber(row.lon);
    if (lat == null || lon == null) continue;
    if (row.valid === false) continue;
    routeFromPoly.push({
      lat,
      lon,
      altitudeMeters: asNumber(row.altitude),
      timestamp:
        asNumber(row.time) != null ? new Date(asNumber(row.time)!) : undefined,
    });
  }

  const routePoints =
    routeFromPoly.length >= 2
      ? routeFromPoly
      : routeFromMetrics.length >= 2
        ? routeFromMetrics
        : [];

  return {
    samples,
    routePoints,
    routeSource: routePoints.length >= 2 ? "garmin_track" : "none",
    measurementCount: samples.length,
    metricKeys,
  };
}

/**
 * Prefer splitSummaries (warmup/interval/cooldown) when lap arrays are empty.
 */
export function parseSplitSummaries(payload: unknown): ParsedLap[] {
  const root = asRecord(payload);
  const rows = Array.isArray(root?.splitSummaries)
    ? (root!.splitSummaries as unknown[])
    : Array.isArray(payload)
      ? (payload as unknown[])
      : [];

  return rows.map((row, index) => {
    const r = asRecord(row) ?? {};
    const distance = asNumber(r.distance) ?? asNumber(r.maxDistance);
    const duration = asNumber(r.duration) ?? asNumber(r.movingDuration);
    const avgSpeed = asNumber(r.averageSpeed) ?? asNumber(r.averageMovingSpeed);
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
      averageHeartRateBpm: asNumber(r.averageHR),
      splitType: asString(r.splitType),
    };
  });
}

export function buildActivityEvaluation(activity: {
  source?: string;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  averagePaceSecPerKm?: number | null;
  averageHeartRateBpm?: number | null;
  maxHeartRateBpm?: number | null;
  averageCadenceSpm?: number | null;
  maxCadenceSpm?: number | null;
  elevationGainMeters?: number | null;
  calories?: number | null;
  rawPayload?: unknown;
}): {
  source: string;
  sourceLabel: string;
  summary: Record<string, number | string | null>;
  zones: {
    seconds: Record<string, number>;
    percents: Record<string, number>;
    totalSeconds: number;
  } | null;
  garminTrainingEffect: ReturnType<typeof extractGarminTrainingEffect>;
  dynamics: Record<string, number | null>;
  sampleStatus: {
    available: boolean;
    explanation: string;
  };
} {
  const raw = asRecord(activity.rawPayload) ?? {};
  const zones = extractGarminZoneSeconds(raw);
  let zoneBlock: {
    seconds: Record<string, number>;
    percents: Record<string, number>;
    totalSeconds: number;
  } | null = null;
  if (zones) {
    const total = zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5;
    const pct = (n: number) =>
      total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0;
    zoneBlock = {
      seconds: { ...zones },
      percents: {
        z1: pct(zones.z1),
        z2: pct(zones.z2),
        z3: pct(zones.z3),
        z4: pct(zones.z4),
        z5: pct(zones.z5),
      },
      totalSeconds: Number(total.toFixed(1)),
    };
  }

  return {
    source: activity.source ?? "garmin",
    sourceLabel: "Garmin Connect Personal API (not Strava)",
    summary: {
      distanceMeters: activity.distanceMeters ?? null,
      durationSeconds: activity.durationSeconds ?? null,
      averagePaceSecPerKm: activity.averagePaceSecPerKm ?? null,
      averageHeartRateBpm: activity.averageHeartRateBpm ?? null,
      maxHeartRateBpm: activity.maxHeartRateBpm ?? null,
      averageCadenceSpm: activity.averageCadenceSpm ?? null,
      maxCadenceSpm:
        activity.maxCadenceSpm ??
        asNumber(raw.maxRunningCadenceInStepsPerMinute) ??
        null,
      elevationGainMeters: activity.elevationGainMeters ?? null,
      calories: activity.calories ?? null,
      averageSpeedMps: asNumber(raw.averageSpeed) ?? null,
      maxSpeedMps: asNumber(raw.maxSpeed) ?? null,
    },
    zones: zoneBlock,
    garminTrainingEffect: extractGarminTrainingEffect(raw),
    dynamics: {
      avgStrideLengthCm: asNumber(raw.avgStrideLength) ?? null,
      avgGroundContactTimeMs: asNumber(raw.avgGroundContactTime) ?? null,
      avgVerticalOscillationCm: asNumber(raw.avgVerticalOscillation) ?? null,
      avgVerticalRatioPct: asNumber(raw.avgVerticalRatio) ?? null,
      avgPowerWatts: asNumber(raw.avgPower) ?? null,
      maxPowerWatts: asNumber(raw.maxPower) ?? null,
      lapCount: asNumber(raw.lapCount) ?? null,
    },
    sampleStatus: {
      available: false,
      explanation:
        "Time-series samples come from Garmin /activity/{id}/details when enriched.",
    },
  };
}
