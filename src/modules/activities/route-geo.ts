export type RoutePoint = {
  lat: number;
  lon: number;
  altitudeMeters?: number;
  timestamp?: Date;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pushIfValid(points: RoutePoint[], lat?: number, lon?: number) {
  if (
    lat == null ||
    lon == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    (lat === 0 && lon === 0)
  ) {
    return;
  }
  points.push({ lat, lon });
}

/** Pull start/end (and nested geo arrays when present) from Garmin payloads. */
export function extractRouteFromPayload(
  payload: Record<string, unknown> | null | undefined
): { points: RoutePoint[]; source: "garmin_track" | "start_end" | "none" } {
  if (!payload) return { points: [], source: "none" };

  const points: RoutePoint[] = [];

  const geoArrays = [
    payload.geoPolylineDTO,
    payload.polyline,
    payload.geoPoints,
    asRecord(payload.geoPolylineDTO)?.polylineEncodedPoints,
  ];

  for (const candidate of geoArrays) {
    if (!Array.isArray(candidate)) continue;
    for (const row of candidate) {
      const r = asRecord(row) ?? {};
      pushIfValid(
        points,
        asNumber(r.lat) ?? asNumber(r.latitude),
        asNumber(r.lon) ?? asNumber(r.longitude) ?? asNumber(r.lng)
      );
    }
    if (points.length >= 2) {
      return { points, source: "garmin_track" };
    }
  }

  // Encoded polyline string is not decoded here; fall back to endpoints.
  pushIfValid(
    points,
    asNumber(payload.startLatitude) ?? asNumber(payload.startLatitudeInDegree),
    asNumber(payload.startLongitude) ?? asNumber(payload.startLongitudeInDegree)
  );
  pushIfValid(
    points,
    asNumber(payload.endLatitude) ?? asNumber(payload.endLatitudeInDegree),
    asNumber(payload.endLongitude) ?? asNumber(payload.endLongitudeInDegree)
  );

  if (points.length >= 2) return { points, source: "start_end" };
  if (points.length === 1) return { points, source: "start_end" };
  return { points: [], source: "none" };
}

export function routeToSvgPath(
  points: RoutePoint[],
  width = 640,
  height = 360,
  padding = 24
): {
  path: string;
  width: number;
  height: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
} | null {
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lonSpan = Math.max(maxLon - minLon, 0.0001);

  const coords = points.map((p) => {
    const x = padding + ((p.lon - minLon) / lonSpan) * (width - padding * 2);
    const y =
      height - padding - ((p.lat - minLat) / latSpan) * (height - padding * 2);
    return [x, y] as const;
  });

  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const start = coords[0];
  const end = coords[coords.length - 1];
  return {
    path,
    width,
    height,
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
  };
}
