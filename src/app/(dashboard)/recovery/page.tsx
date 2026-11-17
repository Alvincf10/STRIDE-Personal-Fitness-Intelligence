"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
} from "@/components/shared/ui";
import { apiGet, apiSend } from "@/lib/client/api";
import { formatDuration } from "@/lib/utils/units";

type RecoveryOverview = {
  status: string;
  label: string;
  disclaimer: string;
  latestDate?: string;
  factors: Array<{
    metric: string;
    status: string;
    value?: number | string;
    note: string;
  }>;
  recent: Array<{
    date: string;
    restingHeartRateBpm?: number;
    hrvMs?: number;
    sleepDurationSeconds?: number;
    sleepScore?: number;
    bodyBattery?: number;
    stressLevel?: number;
  }>;
};

type EnergyTimeline = {
  available: boolean;
  status: string;
  date: string;
  timezone: string;
  explanation: string;
  availableDates: string[];
  daily: {
    bodyBattery: number | null;
    bodyBatteryCharged: number | null;
    bodyBatteryDrained: number | null;
    stressLevel: number | null;
    steps: number | null;
  } | null;
  coverage: {
    bodyBatteryPoints: number;
    stressDaily: boolean;
    activityCount: number;
  } | null;
  tracks: {
    bodyBattery: Array<{ t: string; v: number | null; missing: boolean }>;
    stressDaily: { level: number; maxLevel: number | null; note: string } | null;
    sleep: { start: string; end: string; durationSeconds: number | null } | null;
    activities: Array<{
      id: string;
      name?: string;
      type: string;
      start: string;
      durationSeconds: number | null;
    }>;
  } | null;
};

type Movement = {
  available: boolean;
  status: string;
  explanation: string;
  summary: {
    daysWithSteps: number;
    averageSteps: number | null;
    goalHitDays: number;
    totalFloors: number;
    totalIntensityMinutes: number;
  };
  daily: Array<{
    date: string;
    steps: number | null;
    stepsGoal: number | null;
    floorsAscended: number | null;
    goalMet: boolean | null;
  }>;
};

export default function RecoveryPage() {
  const [data, setData] = useState<RecoveryOverview | null>(null);
  const [timeline, setTimeline] = useState<EnergyTimeline | null>(null);
  const [movement, setMovement] = useState<Movement | null>(null);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load(selectedDate?: string) {
    setLoading(true);
    setError(null);
    try {
      const q = selectedDate ? `?date=${encodeURIComponent(selectedDate)}` : "";
      const [overview, energy, move] = await Promise.all([
        apiGet<RecoveryOverview>("/api/v1/recovery/overview"),
        apiGet<EnergyTimeline>(`/api/v1/recovery/energy-timeline${q}`),
        apiGet<Movement>("/api/v1/movement/overview?days=28"),
      ]);
      setData(overview);
      setTimeline(energy);
      setMovement(move);
      setDate(energy.date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recovery");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function syncHealth() {
    setSyncing(true);
    try {
      await apiSend("/api/v1/sync/health", "POST");
      setTimeout(() => {
        void load(date);
        setSyncing(false);
      }, 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health sync failed");
      setSyncing(false);
    }
  }

  const bb = timeline?.tracks?.bodyBattery ?? [];
  const bbMax = Math.max(
    1,
    ...bb.filter((p) => typeof p.v === "number").map((p) => p.v as number)
  );

  return (
    <div>
      <PageHeader
        eyebrow="Recovery"
        title="Listen to the quiet signals"
        description="Sleep, HRV, resting HR, stress, Body Battery timeline, and daily movement when Garmin supplies them. Informational only."
        actions={
          <button
            className="pressable min-h-11 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-[#07140F]"
            onClick={syncHealth}
            disabled={syncing}
          >
            {syncing ? "Syncing…" : "Sync health data"}
          </button>
        }
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {data ? (
        <div className="space-y-4">
          <Panel hero>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  data.status === "ok"
                    ? "accent"
                    : data.status === "insufficient_data"
                      ? "neutral"
                      : "warning"
                }
              >
                {data.status}
              </Badge>
              {data.latestDate ? <Badge>{data.latestDate}</Badge> : null}
            </div>
            <h2 className="mt-3 text-2xl font-extrabold">{data.label}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{data.disclaimer}</p>
          </Panel>

          <div className="grid gap-3 md:grid-cols-2">
            {data.factors.map((f) => (
              <Panel key={f.metric}>
                <div className="flex items-center justify-between gap-2">
                  <p className="section-label">{f.metric}</p>
                  <Badge
                    tone={
                      f.status === "ok"
                        ? "accent"
                        : f.status === "attention"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {f.status}
                  </Badge>
                </div>
                <p className="metric-figure mt-3 text-2xl font-bold">
                  {f.value == null
                    ? "n/a"
                    : f.metric === "sleep"
                      ? formatDuration(Number(f.value))
                      : String(f.value)}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">{f.note}</p>
              </Panel>
            ))}
          </div>

          {timeline ? (
            <Panel hero>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Energy & stress timeline</h2>
                <Badge tone="accent">{timeline.status}</Badge>
                <Badge>{timeline.timezone}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {timeline.explanation}
              </p>
              {timeline.availableDates?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {timeline.availableDates.slice(0, 10).map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`rounded-[var(--radius-control)] border px-3 py-1.5 text-xs ${
                        d === timeline.date
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[#07140F]"
                          : "border-[var(--border)] text-[var(--muted)]"
                      }`}
                      onClick={() => void load(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              ) : null}
              {!timeline.available ? (
                <div className="mt-3">
                  <EmptyState
                    title="Timeline unavailable"
                    body="Sync health to pull Body Battery series and stress."
                  />
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Body Battery"
                      value={
                        timeline.daily?.bodyBattery != null
                          ? String(timeline.daily.bodyBattery)
                          : "—"
                      }
                    />
                    <MetricCard
                      label="Charged / drained"
                      value={`${timeline.daily?.bodyBatteryCharged ?? "—"} / ${timeline.daily?.bodyBatteryDrained ?? "—"}`}
                    />
                    <MetricCard
                      label="Stress (daily)"
                      value={
                        timeline.daily?.stressLevel != null
                          ? String(timeline.daily.stressLevel)
                          : "—"
                      }
                    />
                    <MetricCard
                      label="BB points"
                      value={String(timeline.coverage?.bodyBatteryPoints ?? 0)}
                    />
                  </div>
                  <div className="mt-4 flex h-24 items-end gap-0.5">
                    {bb.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">
                        No intraday Body Battery points for {timeline.date}.
                      </p>
                    ) : (
                      bb.map((p, i) => {
                        if (p.missing || p.v == null) {
                          return (
                            <div
                              key={`${p.t}-${i}`}
                              className="flex-1 rounded-sm bg-[var(--border)]/40"
                              style={{ height: "12%" }}
                              title={`gap @ ${new Date(p.t).toLocaleTimeString()}`}
                            />
                          );
                        }
                        const h = Math.max(8, (p.v / bbMax) * 100);
                        return (
                          <div
                            key={`${p.t}-${i}`}
                            className="flex-1 rounded-sm bg-[var(--accent)]/85"
                            style={{ height: `${h}%` }}
                            title={`${p.v} @ ${new Date(p.t).toLocaleTimeString()}`}
                          />
                        );
                      })
                    )}
                  </div>
                  {timeline.tracks?.activities?.length ? (
                    <ul className="mt-4 space-y-1 text-xs text-[var(--muted)]">
                      {timeline.tracks.activities.map((a) => (
                        <li key={a.id}>
                          {new Date(a.start).toLocaleTimeString()} · {a.type} ·{" "}
                          {a.name ?? "Activity"}
                          {a.durationSeconds != null
                            ? ` · ${formatDuration(a.durationSeconds)}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {timeline.tracks?.sleep ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Sleep {new Date(timeline.tracks.sleep.start).toLocaleString()} →{" "}
                      {new Date(timeline.tracks.sleep.end).toLocaleString()}
                    </p>
                  ) : null}
                </>
              )}
            </Panel>
          ) : null}

          {movement ? (
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Daily movement</h2>
                <Badge tone="accent">{movement.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {movement.explanation}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Avg steps"
                  value={
                    movement.summary.averageSteps != null
                      ? String(movement.summary.averageSteps)
                      : "—"
                  }
                />
                <MetricCard
                  label="Goal hit days"
                  value={String(movement.summary.goalHitDays)}
                />
                <MetricCard
                  label="Floors"
                  value={String(movement.summary.totalFloors)}
                />
                <MetricCard
                  label="Intensity min"
                  value={String(movement.summary.totalIntensityMinutes)}
                />
              </div>
              <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                {[...movement.daily].reverse().slice(0, 14).map((d) => (
                  <li
                    key={d.date}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border)] px-4 py-2 text-xs"
                  >
                    <span>{d.date}</span>
                    <span className="metric-figure font-semibold">
                      {d.steps ?? "—"} steps
                      {d.stepsGoal != null ? ` / ${d.stepsGoal}` : ""}
                      {d.floorsAscended != null
                        ? ` · ${d.floorsAscended} fl`
                        : ""}
                      {d.goalMet === true ? " · goal" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel>
            <h2 className="text-lg font-bold">Recent days</h2>
            {!data.recent.length ? (
              <div className="mt-3">
                <EmptyState
                  title="No health days stored"
                  body="Run Sync health data after Garmin connection is active."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {data.recent.map((d) => (
                  <li
                    key={d.date}
                    className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-2"
                  >
                    <span className="font-semibold">{d.date}</span>
                    <span className="metric-figure text-[var(--muted)]">
                      RHR {d.restingHeartRateBpm ?? "n/a"} · HRV{" "}
                      {d.hrvMs ?? "n/a"} · BB {d.bodyBattery ?? "n/a"} · Stress{" "}
                      {d.stressLevel ?? "n/a"} · Sleep{" "}
                      {d.sleepDurationSeconds != null
                        ? formatDuration(d.sleepDurationSeconds)
                        : "n/a"}
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
