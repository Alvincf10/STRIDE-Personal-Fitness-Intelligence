import Link from "next/link";
import { Badge, IntensityBadge, Panel } from "@/components/shared/ui";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "@/lib/utils/units";

export function RunCard({
  id,
  name,
  startedAt,
  distanceMeters,
  durationSeconds,
  averagePaceSecPerKm,
  averageHeartRateBpm,
}: {
  id: string;
  name?: string;
  startedAt: string;
  distanceMeters?: number;
  durationSeconds?: number;
  averagePaceSecPerKm?: number;
  averageHeartRateBpm?: number;
}) {
  return (
    <Link href={`/activities/${id}`} className="block">
      <Panel className="pressable hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold text-[var(--text)]">
              {name || "Run"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {new Date(startedAt).toLocaleString()}
            </p>
          </div>
          <IntensityBadge averageHeartRateBpm={averageHeartRateBpm} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="section-label">Distance</p>
            <p className="metric-figure mt-1 text-lg font-bold">
              {formatDistance(distanceMeters, "km")}
            </p>
          </div>
          <div>
            <p className="section-label">Pace</p>
            <p className="metric-figure mt-1 text-lg font-bold">
              {formatPace(averagePaceSecPerKm, "min/km")}
            </p>
          </div>
          <div>
            <p className="section-label">Time</p>
            <p className="metric-figure mt-1 text-lg font-bold">
              {formatDuration(durationSeconds)}
            </p>
          </div>
          <div>
            <p className="section-label">Avg HR</p>
            <p className="metric-figure mt-1 text-lg font-bold">
              {averageHeartRateBpm != null
                ? `${Math.round(averageHeartRateBpm)} bpm`
                : "Unavailable"}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Badge tone="accent">Open run</Badge>
        </div>
      </Panel>
    </Link>
  );
}
