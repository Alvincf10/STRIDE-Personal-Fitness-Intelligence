"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RouteMap } from "@/components/activities/route-map";
import {
  Badge,
  EmptyState,
  ErrorState,
  IntensityBadge,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
} from "@/components/shared/ui";
import { apiGet, apiSend } from "@/lib/client/api";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "@/lib/utils/units";

type DetailResponse = {
  activity: {
    activityName?: string;
    startedAt: string;
    source?: string;
    distanceMeters?: number;
    durationSeconds?: number;
    averagePaceSecPerKm?: number;
    averageHeartRateBpm?: number;
    maxHeartRateBpm?: number;
    averageCadenceSpm?: number;
    elevationGainMeters?: number;
    calories?: number;
  };
  detail: {
    laps?: Array<{
      lapNumber: number;
      distanceMeters?: number;
      durationSeconds?: number;
      averagePaceSecPerKm?: number;
      averageHeartRateBpm?: number;
      splitType?: string;
    }>;
    samples?: Array<{
      timestamp: string;
      heartRateBpm?: number;
      paceSecPerKm?: number;
      cadenceSpm?: number;
      altitudeMeters?: number;
    }>;
    routePoints?: Array<{ lat: number; lon: number }>;
    routeSource?: string;
  } | null;
  evaluation?: {
    sourceLabel: string;
    summary: Record<string, number | string | null>;
    zones: {
      seconds: Record<string, number>;
      percents: Record<string, number>;
      totalSeconds: number;
    } | null;
    garminTrainingEffect: {
      aerobicTrainingEffect: number | null;
      anaerobicTrainingEffect: number | null;
      trainingEffectLabel: string | null;
      garminTrainingLoad: number | null;
    };
    dynamics: Record<string, number | null>;
    sampleStatus: { available: boolean; explanation: string };
  };
};

function sampleSeries(
  samples: NonNullable<DetailResponse["detail"]>["samples"]
) {
  if (!samples?.length) return null;
  const hrs = samples
    .map((s) => s.heartRateBpm)
    .filter((v): v is number => typeof v === "number");
  const paces = samples
    .map((s) => s.paceSecPerKm)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return {
    count: samples.length,
    hrMin: hrs.length ? Math.min(...hrs) : null,
    hrMax: hrs.length ? Math.max(...hrs) : null,
    hrAvg: hrs.length
      ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length)
      : null,
    paceBest: paces.length ? Math.min(...paces) : null,
    paceMedian: paces.length
      ? [...paces].sort((a, b) => a - b)[Math.floor(paces.length / 2)]
      : null,
    sparkHr: samples
      .filter((_, i) => i % Math.max(1, Math.floor(samples.length / 48)) === 0)
      .map((s) => s.heartRateBpm ?? null),
  };
}

export default function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fitBusy, setFitBusy] = useState(false);
  const [fitNote, setFitNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await apiGet<DetailResponse>(
          `/api/v1/activities/${params.id}`
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const a = data?.activity;
  const evaluation = data?.evaluation;
  const series = useMemo(
    () => sampleSeries(data?.detail?.samples),
    [data?.detail?.samples]
  );

  async function downloadFit() {
    if (!params.id) return;
    setFitBusy(true);
    setFitNote(null);
    try {
      const artifact = await apiSend<{
        status?: string;
        byteSize?: number;
        checksumSha256?: string;
        sanitizedError?: string;
      }>("/api/v1/fit/download", "POST", { activityId: params.id });
      setFitNote(
        artifact.sanitizedError
          ? artifact.sanitizedError
          : `FIT ${artifact.status ?? "stored"}${
              artifact.byteSize != null ? ` · ${artifact.byteSize} bytes` : ""
            }${
              artifact.checksumSha256
                ? ` · sha256 ${artifact.checksumSha256.slice(0, 12)}…`
                : ""
            }`
      );
    } catch (err) {
      setFitNote(err instanceof Error ? err.message : "FIT download failed");
    } finally {
      setFitBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Run detail"
        title={a?.activityName || "Activity"}
        description={
          a
            ? `${new Date(a.startedAt).toLocaleString()} · ${evaluation?.sourceLabel ?? "Garmin"}`
            : "Loading your run…"
        }
        actions={
          a ? (
            <div className="flex flex-wrap items-center gap-2">
              <IntensityBadge averageHeartRateBpm={a.averageHeartRateBpm} />
              <button
                type="button"
                className="pressable min-h-11 rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-sm font-semibold"
                onClick={downloadFit}
                disabled={fitBusy}
              >
                {fitBusy ? "FIT…" : "Download FIT"}
              </button>
            </div>
          ) : undefined
        }
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {a ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Distance"
              value={formatDistance(a.distanceMeters, "km")}
              size="lg"
            />
            <MetricCard
              label="Duration"
              value={formatDuration(a.durationSeconds)}
            />
            <MetricCard
              label="Avg pace"
              value={formatPace(a.averagePaceSecPerKm, "min/km")}
            />
            <MetricCard
              label="Avg HR"
              value={
                a.averageHeartRateBpm != null
                  ? `${Math.round(a.averageHeartRateBpm)} bpm`
                  : "Unavailable"
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Max HR"
              value={
                a.maxHeartRateBpm != null
                  ? `${Math.round(a.maxHeartRateBpm)} bpm`
                  : "—"
              }
            />
            <MetricCard
              label="Cadence"
              value={
                a.averageCadenceSpm != null
                  ? `${Math.round(a.averageCadenceSpm)} spm`
                  : "—"
              }
            />
            <MetricCard
              label="Elevation"
              value={
                a.elevationGainMeters != null
                  ? `${Math.round(a.elevationGainMeters)} m`
                  : "—"
              }
            />
            <MetricCard
              label="Calories"
              value={a.calories != null ? String(Math.round(a.calories)) : "—"}
            />
          </div>

          {evaluation?.garminTrainingEffect ? (
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Garmin Training Effect</h2>
                {evaluation.garminTrainingEffect.trainingEffectLabel ? (
                  <Badge tone="accent">
                    {evaluation.garminTrainingEffect.trainingEffectLabel}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Aerobic TE"
                  value={
                    evaluation.garminTrainingEffect.aerobicTrainingEffect !=
                    null
                      ? String(
                          evaluation.garminTrainingEffect.aerobicTrainingEffect
                        )
                      : "—"
                  }
                />
                <MetricCard
                  label="Anaerobic TE"
                  value={
                    evaluation.garminTrainingEffect.anaerobicTrainingEffect !=
                    null
                      ? String(
                          evaluation.garminTrainingEffect
                            .anaerobicTrainingEffect
                        )
                      : "—"
                  }
                />
                <MetricCard
                  label="Garmin Training Load"
                  value={
                    evaluation.garminTrainingEffect.garminTrainingLoad != null
                      ? String(
                          evaluation.garminTrainingEffect.garminTrainingLoad
                        )
                      : "Not in payload"
                  }
                />
              </div>
            </Panel>
          ) : null}

          {evaluation?.zones ? (
            <Panel>
              <h2 className="text-lg font-bold">HR zones (Garmin summary)</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-5">
                {(["z1", "z2", "z3", "z4", "z5"] as const).map((key) => (
                  <div
                    key={key}
                    className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface)]/50 p-3"
                  >
                    <p className="section-label">{key.toUpperCase()}</p>
                    <p className="metric-figure mt-2 text-2xl font-extrabold text-[var(--accent)]">
                      {evaluation.zones!.percents[key]}%
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatDuration(evaluation.zones!.seconds[key])}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {evaluation?.dynamics ? (
            <Panel>
              <h2 className="text-lg font-bold">Running dynamics</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard
                  label="Stride"
                  value={
                    evaluation.dynamics.avgStrideLengthCm != null
                      ? `${evaluation.dynamics.avgStrideLengthCm.toFixed(0)} cm`
                      : "—"
                  }
                />
                <MetricCard
                  label="Ground contact"
                  value={
                    evaluation.dynamics.avgGroundContactTimeMs != null
                      ? `${Math.round(evaluation.dynamics.avgGroundContactTimeMs)} ms`
                      : "—"
                  }
                />
                <MetricCard
                  label="Avg power"
                  value={
                    evaluation.dynamics.avgPowerWatts != null
                      ? `${Math.round(evaluation.dynamics.avgPowerWatts)} W`
                      : "—"
                  }
                />
              </div>
            </Panel>
          ) : null}

          {fitNote ? (
            <p className="text-xs text-[var(--muted)]">FIT: {fitNote}</p>
          ) : null}

          <Panel>
            <h2 className="text-lg font-bold">Route</h2>
            <div className="mt-3">
              <RouteMap
                points={data?.detail?.routePoints ?? []}
                source={data?.detail?.routeSource}
              />
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">HR / pace samples</h2>
              <Badge tone={series ? "accent" : "neutral"}>
                {series ? `${series.count} points` : "none"}
              </Badge>
            </div>
            {!series ? (
              <div className="mt-3">
                <EmptyState
                  title="No chart samples yet"
                  body={
                    evaluation?.sampleStatus.explanation ??
                    "Connect Garmin and reopen this run to pull /activity/details charts."
                  }
                />
              </div>
            ) : (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Sample avg HR" value={`${series.hrAvg ?? "—"}`} />
                  <MetricCard
                    label="Sample HR range"
                    value={
                      series.hrMin != null && series.hrMax != null
                        ? `${series.hrMin}–${series.hrMax}`
                        : "—"
                    }
                  />
                  <MetricCard
                    label="Best sample pace"
                    value={formatPace(series.paceBest ?? undefined, "min/km")}
                  />
                  <MetricCard
                    label="Median sample pace"
                    value={formatPace(series.paceMedian ?? undefined, "min/km")}
                  />
                </div>
                <div className="mt-4 flex h-16 items-end gap-0.5">
                  {series.sparkHr.map((v, i) => {
                    const max = series.hrMax ?? 1;
                    const min = series.hrMin ?? 0;
                    const h =
                      v == null
                        ? 4
                        : Math.max(4, ((v - min) / Math.max(1, max - min)) * 100);
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-[var(--accent)]/80"
                        style={{ height: `${h}%` }}
                        title={v != null ? `${v} bpm` : "gap"}
                      />
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {evaluation?.sampleStatus.explanation}
                </p>
              </>
            )}
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Splits / intervals</h2>
            {!data?.detail?.laps?.length ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No split summaries stored for this activity.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {data.detail.laps.map((lap) => (
                  <li
                    key={lap.lapNumber}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-raised)]/40 px-4 py-3 text-sm"
                  >
                    <span className="font-semibold">
                      {lap.splitType
                        ? lap.splitType.replaceAll("_", " ")
                        : `Lap ${lap.lapNumber}`}
                    </span>
                    <span className="metric-figure text-[var(--muted)]">
                      {formatDistance(lap.distanceMeters, "km")} ·{" "}
                      {formatPace(lap.averagePaceSecPerKm, "min/km")}
                      {lap.averageHeartRateBpm != null
                        ? ` · ${Math.round(lap.averageHeartRateBpm)} bpm`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
