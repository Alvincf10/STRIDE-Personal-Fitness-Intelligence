"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
} from "@/components/shared/ui";
import { apiGet, apiSend } from "@/lib/client/api";
import { formatDistance, formatDuration, formatPace } from "@/lib/utils/units";

type Overview = {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  activityCount: number;
  averagePaceSecPerKm?: number;
};

type PacePoint = {
  id: string;
  startedAt: string;
  averagePaceSecPerKm?: number;
  distanceMeters?: number;
};

type Vo2 = { available: boolean; points: Array<{ date: string; vo2Max?: number }> };

type Dna = {
  calculationVersion: string;
  windowDays: number;
  methodology: string;
  dimensions: Array<{
    dimension: string;
    score: number;
    evidence: string;
  }>;
};

type Baseline = {
  _id: string;
  metric: string;
  value: number;
  unit: string;
  sampleCount: number;
  method: string;
  generatedAt: string;
  calculationVersion: string;
};

type HrZones = {
  available: boolean;
  status: string;
  calculationVersion: string;
  method: string;
  sourceLabel: string;
  limitations: string[];
  windowDays: number;
  eligibleActivityCount: number;
  ineligibleActivityCount: number;
  explanation: string;
  zone2: { seconds: number; percent: number; eligibleActivityCount: number } | null;
  distribution: {
    seconds: { z1: number; z2: number; z3: number; z4: number; z5: number };
    percents: { z1: number; z2: number; z3: number; z4: number; z5: number };
    totalSeconds: number;
  } | null;
};

type AerobicEfficiency = {
  available: boolean;
  status: string;
  calculationVersion: string;
  method: string;
  sourceLabel: string;
  limitations: string[];
  windowDays: number;
  qualifyingActivityCount: number;
  explanation: string;
  comparisons: Array<{
    band: string;
    paceDeltaSecPerKm: number | null;
    note: string;
    current: {
      sampleCount: number;
      medianPaceSecPerKm: number | null;
    };
  }>;
};

type TrainingLoad = {
  available: boolean;
  status: string;
  calculationVersion: string;
  method: string;
  sourceLabel: string;
  label: string;
  limitations: string[];
  windowDays: number;
  explanation: string;
  volume: {
    last7Days: {
      durationSeconds: number;
      distanceMeters: number;
      strideEstimatedLoad: number;
    };
    last28Days: {
      durationSeconds: number;
      distanceMeters: number;
      strideEstimatedLoad: number;
    };
    previous7Days: { strideEstimatedLoad: number };
  };
  impulseResponse: {
    acuteLoad: number;
    chronicLoad: number;
    formScore: number;
    acuteChronicRatio: number | null;
    note: string;
  };
  historicalRange: {
    current7DayPercentile: number | null;
    min7: number | null;
    max7: number | null;
    median7: number | null;
  };
  rapidChange: {
    triggered: boolean;
    direction: string;
    changeFraction: number | null;
    explanation: string;
    recent7DayLoad: number;
    previous7DayLoad: number;
  };
  coverage: {
    withStrideLoad: number;
    withoutStrideLoad: number;
    withGarminTeOrLoad: number;
  };
  daily: Array<{
    date: string;
    activityCount: number;
    durationSeconds: number;
    distanceMeters: number;
    strideEstimatedLoad: number | null;
    acuteLoad: number;
    chronicLoad: number;
    formScore: number;
    garminAerobicTeMax: number | null;
  }>;
  recentActivities: Array<{
    id: string;
    activityName?: string;
    startedAt: string;
    strideEstimatedLoad: number | null;
    missingHrReason: string | null;
    garmin: {
      aerobicTrainingEffect: number | null;
      anaerobicTrainingEffect: number | null;
      trainingEffectLabel: string | null;
      garminTrainingLoad: number | null;
    };
  }>;
};

type Decoupling = {
  available: boolean;
  status: string;
  calculationVersion: string;
  method: string;
  sourceLabel: string;
  limitations: string[];
  windowDays: number;
  explanation: string;
  eligibleCount: number;
  ineligibleCount: number;
  sessions: Array<{
    activityId: string;
    activityName?: string;
    startedAt: string;
    eligible: boolean;
    ineligibleReason: string | null;
    decouplingPercent: number | null;
    firstHalf: { meanHr: number | null; meanPaceSecPerKm: number | null };
    secondHalf: { meanHr: number | null; meanPaceSecPerKm: number | null };
    sampleCoverage: { pairedSamples: number; usedSamples: number };
  }>;
};

type MultiSport = {
  available: boolean;
  status: string;
  explanation: string;
  sports: Array<{
    activityType: string;
    count: number;
    totalDurationSeconds: number;
    totalDistanceMeters: number;
  }>;
};

export default function PerformancePage() {
  const [weekly, setWeekly] = useState<Overview | null>(null);
  const [monthly, setMonthly] = useState<Overview | null>(null);
  const [pace, setPace] = useState<PacePoint[]>([]);
  const [vo2, setVo2] = useState<Vo2 | null>(null);
  const [dna, setDna] = useState<Dna | null>(null);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [history, setHistory] = useState<Baseline[]>([]);
  const [hrZones, setHrZones] = useState<HrZones | null>(null);
  const [efficiency, setEfficiency] = useState<AerobicEfficiency | null>(null);
  const [trainingLoad, setTrainingLoad] = useState<TrainingLoad | null>(null);
  const [decoupling, setDecoupling] = useState<Decoupling | null>(null);
  const [multiSport, setMultiSport] = useState<MultiSport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [w, m, p, v, d, b, h, zones, eff, tl, dec, ms] = await Promise.all([
        apiGet<Overview>("/api/v1/analytics/weekly"),
        apiGet<Overview>("/api/v1/analytics/monthly"),
        apiGet<PacePoint[]>("/api/v1/analytics/pace"),
        apiGet<Vo2>("/api/v1/analytics/vo2max"),
        apiGet<Dna>("/api/v1/running-dna"),
        apiGet<Baseline[]>("/api/v1/baseline"),
        apiGet<Baseline[]>("/api/v1/baseline/history?limit=30"),
        apiGet<HrZones>("/api/v1/performance/hr-zones?days=28"),
        apiGet<AerobicEfficiency>(
          "/api/v1/performance/aerobic-efficiency?days=28"
        ),
        apiGet<TrainingLoad>("/api/v1/performance/training-load?days=42"),
        apiGet<Decoupling>("/api/v1/performance/decoupling?days=28"),
        apiGet<MultiSport>("/api/v1/multi-sport/overview?days=90"),
      ]);
      setWeekly(w);
      setMonthly(m);
      setPace(p);
      setVo2(v);
      setDna(d);
      setBaselines(b);
      setHistory(h);
      setHrZones(zones);
      setEfficiency(eff);
      setTrainingLoad(tl);
      setDecoupling(dec);
      setMultiSport(ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load progress");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function recalculate() {
    setBusy(true);
    try {
      await apiSend("/api/v1/baseline/recalculate", "POST");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Baseline recalculation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Performance Lab"
        title="Running DNA & progress"
        description="Descriptive indices from your own history, personal baselines, volume, pace, and VO2 when Garmin sends it."
        actions={
          <Button onClick={recalculate} disabled={busy}>
            {busy ? "Recalculating…" : "Recalculate baselines"}
          </Button>
        }
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && weekly && monthly ? (
        <div className="space-y-6">
          {hrZones ? (
            <Panel hero>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">HR Zone Intelligence</h2>
                <Badge tone="accent">{hrZones.status}</Badge>
                <Badge>{hrZones.windowDays}d</Badge>
                <Badge>v{hrZones.calculationVersion}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{hrZones.explanation}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{hrZones.sourceLabel}</p>
              {!hrZones.available || !hrZones.distribution ? (
                <div className="mt-3">
                  <EmptyState
                    title="Zone-time unavailable"
                    body="Needs Garmin hrTimeInZone_* on activities. Average HR alone is not enough."
                  />
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-2 sm:grid-cols-5">
                    {(["z1", "z2", "z3", "z4", "z5"] as const).map((key) => (
                      <div
                        key={key}
                        className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface)]/50 p-3"
                      >
                        <p className="section-label">{key.toUpperCase()}</p>
                        <p className="metric-figure mt-2 text-2xl font-extrabold text-[var(--accent)]">
                          {hrZones.distribution!.percents[key]}%
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatDuration(hrZones.distribution!.seconds[key])}
                        </p>
                      </div>
                    ))}
                  </div>
                  {hrZones.zone2 ? (
                    <p className="mt-4 text-sm">
                      Zone 2:{" "}
                      <span className="metric-figure font-semibold">
                        {hrZones.zone2.percent}%
                      </span>{" "}
                      · {formatDuration(hrZones.zone2.seconds)} across{" "}
                      {hrZones.zone2.eligibleActivityCount} eligible run(s)
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Eligible {hrZones.eligibleActivityCount} · excluded{" "}
                    {hrZones.ineligibleActivityCount}. {hrZones.limitations[0]}
                  </p>
                </>
              )}
            </Panel>
          ) : null}

          {trainingLoad ? (
            <Panel hero>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{trainingLoad.label}</h2>
                <Badge tone="accent">{trainingLoad.status}</Badge>
                <Badge>{trainingLoad.windowDays}d</Badge>
                <Badge>v{trainingLoad.calculationVersion}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {trainingLoad.explanation}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {trainingLoad.sourceLabel}
              </p>
              {!trainingLoad.available ? (
                <div className="mt-3">
                  <EmptyState
                    title="STRIDE load unavailable"
                    body="Needs Garmin hrTimeInZone_* on runs. Duration/distance alone do not invent HR load."
                  />
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="7d STRIDE load"
                      value={String(
                        trainingLoad.volume.last7Days.strideEstimatedLoad
                      )}
                      size="lg"
                    />
                    <MetricCard
                      label="28d STRIDE load"
                      value={String(
                        trainingLoad.volume.last28Days.strideEstimatedLoad
                      )}
                    />
                    <MetricCard
                      label="Acute (ATL)"
                      value={trainingLoad.impulseResponse.acuteLoad.toFixed(1)}
                    />
                    <MetricCard
                      label="Chronic (CTL)"
                      value={trainingLoad.impulseResponse.chronicLoad.toFixed(1)}
                    />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Form (CTL−ATL)"
                      value={trainingLoad.impulseResponse.formScore.toFixed(1)}
                    />
                    <MetricCard
                      label="7d distance"
                      value={formatDistance(
                        trainingLoad.volume.last7Days.distanceMeters,
                        "km"
                      )}
                    />
                    <MetricCard
                      label="7d duration"
                      value={formatDuration(
                        trainingLoad.volume.last7Days.durationSeconds
                      )}
                    />
                    <MetricCard
                      label="Own-history %ile"
                      value={
                        trainingLoad.historicalRange.current7DayPercentile !=
                        null
                          ? `${trainingLoad.historicalRange.current7DayPercentile}`
                          : "n/a"
                      }
                    />
                  </div>
                  <p className="mt-3 text-sm">
                    Rapid change:{" "}
                    <Badge
                      tone={
                        trainingLoad.rapidChange.triggered ? "accent" : undefined
                      }
                    >
                      {trainingLoad.rapidChange.triggered
                        ? trainingLoad.rapidChange.direction
                        : "stable"}
                    </Badge>{" "}
                    <span className="text-[var(--muted)]">
                      {trainingLoad.rapidChange.explanation}
                    </span>
                  </p>
                  {trainingLoad.impulseResponse.acuteChronicRatio != null ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Acute:chronic ={" "}
                      {trainingLoad.impulseResponse.acuteChronicRatio} —{" "}
                      {trainingLoad.impulseResponse.note}
                    </p>
                  ) : null}
                  <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                    {[...trainingLoad.daily]
                      .reverse()
                      .filter((d) => d.activityCount > 0 || d.strideEstimatedLoad)
                      .slice(0, 14)
                      .map((d) => (
                        <li
                          key={d.date}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border)] px-4 py-2 text-xs"
                        >
                          <span>
                            {d.date} · {d.activityCount} run(s)
                            {d.garminAerobicTeMax != null
                              ? ` · Garmin TE ${d.garminAerobicTeMax}`
                              : ""}
                          </span>
                          <span className="metric-figure font-semibold">
                            load{" "}
                            {d.strideEstimatedLoad != null
                              ? d.strideEstimatedLoad
                              : "—"}{" "}
                            · ATL {d.acuteLoad.toFixed(1)} · CTL{" "}
                            {d.chronicLoad.toFixed(1)}
                          </span>
                        </li>
                      ))}
                  </ul>
                  <ul className="mt-3 space-y-2">
                    {trainingLoad.recentActivities.slice(0, 6).map((a) => (
                      <li
                        key={a.id}
                        className="rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">
                            {a.activityName ?? "Run"} ·{" "}
                            {new Date(a.startedAt).toLocaleDateString()}
                          </p>
                          <Badge>
                            STRIDE{" "}
                            {a.strideEstimatedLoad != null
                              ? a.strideEstimatedLoad
                              : "n/a"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Garmin TE aerobic{" "}
                          {a.garmin.aerobicTrainingEffect ?? "n/a"}
                          {a.garmin.trainingEffectLabel
                            ? ` (${a.garmin.trainingEffectLabel})`
                            : ""}
                          {a.garmin.garminTrainingLoad != null
                            ? ` · Garmin load ${a.garmin.garminTrainingLoad}`
                            : " · Garmin Training Load not in payload"}
                          {a.missingHrReason ? ` · ${a.missingHrReason}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-3 text-xs text-[var(--muted)]">
                {trainingLoad.limitations[0]} Zone-load runs:{" "}
                {trainingLoad.coverage.withStrideLoad}; excluded:{" "}
                {trainingLoad.coverage.withoutStrideLoad}.
              </p>
            </Panel>
          ) : null}

          {efficiency ? (
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Aerobic Efficiency</h2>
                <Badge tone="accent">{efficiency.status}</Badge>
                <Badge>{efficiency.windowDays}d</Badge>
                <Badge>v{efficiency.calculationVersion}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{efficiency.explanation}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{efficiency.sourceLabel}</p>
              {!efficiency.available ? (
                <div className="mt-3">
                  <EmptyState
                    title="Not enough comparable efforts"
                    body="Need multiple runs ≥ 3 km with average HR."
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {efficiency.comparisons
                    .filter((c) => c.current.sampleCount > 0)
                    .map((c) => (
                      <li
                        key={c.band}
                        className="rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold uppercase">{c.band}</p>
                          <Badge>{c.current.sampleCount} runs</Badge>
                        </div>
                        <p className="metric-figure mt-2 text-lg font-bold">
                          {formatPace(c.current.medianPaceSecPerKm ?? undefined, "min/km")}
                          {c.paceDeltaSecPerKm != null
                            ? ` · Δ ${c.paceDeltaSecPerKm > 0 ? "+" : ""}${c.paceDeltaSecPerKm.toFixed(0)}s/km`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{c.note}</p>
                      </li>
                    ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-[var(--muted)]">
                {efficiency.limitations[0]} Qualifying runs:{" "}
                {efficiency.qualifyingActivityCount}.
              </p>
            </Panel>
          ) : null}

          {decoupling ? (
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Aerobic Decoupling</h2>
                <Badge tone="accent">{decoupling.status}</Badge>
                <Badge>v{decoupling.calculationVersion}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {decoupling.explanation}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {decoupling.sourceLabel}
              </p>
              {!decoupling.available ? (
                <div className="mt-3">
                  <EmptyState
                    title="No eligible sessions"
                    body="Needs sustained runs with paired HR+pace chart samples (not whole-run averages)."
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {decoupling.sessions
                    .filter((s) => s.eligible)
                    .map((s) => (
                      <li
                        key={s.activityId}
                        className="rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">
                            {s.activityName ?? "Run"} ·{" "}
                            {new Date(s.startedAt).toLocaleDateString()}
                          </p>
                          <Badge tone="accent">
                            {s.decouplingPercent != null
                              ? `${s.decouplingPercent}%`
                              : "n/a"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          1st half HR {s.firstHalf.meanHr ?? "—"} · pace{" "}
                          {formatPace(
                            s.firstHalf.meanPaceSecPerKm ?? undefined,
                            "min/km"
                          )}{" "}
                          → 2nd HR {s.secondHalf.meanHr ?? "—"} · pace{" "}
                          {formatPace(
                            s.secondHalf.meanPaceSecPerKm ?? undefined,
                            "min/km"
                          )}{" "}
                          · samples {s.sampleCoverage.usedSamples}
                        </p>
                      </li>
                    ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-[var(--muted)]">
                Eligible {decoupling.eligibleCount} · excluded{" "}
                {decoupling.ineligibleCount}. {decoupling.limitations[0]}
              </p>
            </Panel>
          ) : null}

          {multiSport ? (
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Multi-sport mix</h2>
                <Badge tone="accent">{multiSport.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {multiSport.explanation}
              </p>
              <ul className="mt-4 space-y-2">
                {multiSport.sports.map((s) => (
                  <li
                    key={s.activityType}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm"
                  >
                    <span className="font-semibold">{s.activityType}</span>
                    <span className="metric-figure text-[var(--muted)]">
                      {s.count} · {formatDuration(s.totalDurationSeconds)} ·{" "}
                      {formatDistance(s.totalDistanceMeters, "km")}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {dna ? (
            <Panel hero>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Running DNA</h2>
                <Badge>{dna.windowDays}d window</Badge>
                <Badge tone="accent">v{dna.calculationVersion}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{dna.methodology}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {dna.dimensions.map((dim) => (
                  <div
                    key={dim.dimension}
                    className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface)]/50 p-3"
                  >
                    <p className="section-label">{dim.dimension.replaceAll("_", " ")}</p>
                    <p className="metric-figure mt-2 text-3xl font-extrabold text-[var(--accent)]">
                      {dim.score}
                    </p>
                    <p className="mt-2 text-xs text-[var(--muted)]">{dim.evidence}</p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel>
            <h2 className="text-lg font-bold">Personal baselines</h2>
            {!baselines.length ? (
              <div className="mt-3">
                <EmptyState
                  title="No baselines yet"
                  body="Sync health + activities, then recalculate. Needs enough samples per metric."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {baselines.map((b) => (
                  <li
                    key={b._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{b.metric.replaceAll("_", " ")}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {b.method} · n={b.sampleCount} ·{" "}
                        {new Date(b.generatedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="metric-figure text-lg font-bold">
                      {b.value.toFixed(1)} {b.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Baseline history</h2>
            {!history.length ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                Recalculations will stack here so you can see drift over time.
              </p>
            ) : (
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {history.map((h) => (
                  <li
                    key={h._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border)] px-4 py-2 text-xs"
                  >
                    <span>
                      {h.metric} · {new Date(h.generatedAt).toLocaleDateString()}
                    </span>
                    <span className="metric-figure font-semibold">
                      {h.value.toFixed(1)} {h.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <section>
            <h2 className="mb-3 text-lg font-bold">This week</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Distance"
                value={formatDistance(weekly.totalDistanceMeters, "km")}
                size="lg"
              />
              <MetricCard
                label="Duration"
                value={formatDuration(weekly.totalDurationSeconds)}
              />
              <MetricCard label="Runs" value={String(weekly.activityCount)} />
              <MetricCard
                label="Avg pace"
                value={formatPace(weekly.averagePaceSecPerKm, "min/km")}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold">Last 30 days</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Distance"
                value={formatDistance(monthly.totalDistanceMeters, "km")}
              />
              <MetricCard
                label="Duration"
                value={formatDuration(monthly.totalDurationSeconds)}
              />
              <MetricCard label="Runs" value={String(monthly.activityCount)} />
              <MetricCard
                label="Avg pace"
                value={formatPace(monthly.averagePaceSecPerKm, "min/km")}
              />
            </div>
          </section>

          <Panel>
            <h2 className="text-lg font-bold">Pace progression</h2>
            {pace.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="Not enough comparable sessions"
                  body="Pace progression uses running activities of at least 3 km."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {pace.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm"
                  >
                    <span>{new Date(p.startedAt).toLocaleDateString()}</span>
                    <span className="metric-figure font-semibold">
                      {formatPace(p.averagePaceSecPerKm, "min/km")} ·{" "}
                      {formatDistance(p.distanceMeters, "km")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel hero>
            <h2 className="text-lg font-bold">VO2 Max trend</h2>
            {!vo2?.available ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Unavailable until Garmin health sync provides VO2 Max values.
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {vo2.points.map((p) => (
                  <li key={p.date} className="flex justify-between">
                    <span>{p.date}</span>
                    <span className="metric-figure text-lg font-bold text-[var(--accent)]">
                      {p.vo2Max}
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
