export function metersToKm(meters: number): number {
  return meters / 1000;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

export function formatDistance(
  meters: number | undefined,
  unit: "km" | "mi"
): string {
  if (meters == null || !Number.isFinite(meters)) return "Unavailable";
  const value = unit === "km" ? metersToKm(meters) : metersToMiles(meters);
  return `${value.toFixed(2)} ${unit}`;
}

export function formatPace(
  secPerKm: number | undefined,
  unit: "min/km" | "min/mi"
): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "Unavailable";
  }
  const seconds =
    unit === "min/km" ? secPerKm : secPerKm * (1609.344 / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")} ${unit}`;
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "Unavailable";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m ${s
      .toString()
      .padStart(2, "0")}s`;
  }
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function paceFromDistanceDuration(
  distanceMeters: number,
  durationSeconds: number
): number | undefined {
  if (
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationSeconds) ||
    distanceMeters <= 0 ||
    durationSeconds <= 0
  ) {
    return undefined;
  }
  const km = distanceMeters / 1000;
  return durationSeconds / km;
}
