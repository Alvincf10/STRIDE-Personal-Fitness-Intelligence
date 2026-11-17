"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DistanceTrendChart } from "@/components/charts/distance-trend";
import { RunCard } from "@/components/running/run-card";
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
} from "@/components/shared/ui";
import { apiGet } from "@/lib/client/api";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "@/lib/utils/units";

type Overview = {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  activityCount: number;
  averagePaceSecPerKm?: number;
  averageHeartRateBpm?: number;
  weeklyDistanceTrend: Array<{ weekStart: string; distanceMeters: number }>;
  recentActivities: Array<{
    _id: string;
    activityName?: string;
    startedAt: string;
    distanceMeters?: number;
    durationSeconds?: number;
    averagePaceSecPerKm?: number;
    averageHeartRateBpm?: number;
  }>;
};

type SyncStatus = {
  lastSuccessfulSyncAt: string | null;
};

type DataQualitySummary = {
  summary: {
    activitySyncStatus: string;
    healthSyncStatus: string;
    lastActivitySyncAt: string | null;
    lastHealthSyncAt: string | null;
    featuresBlocked: number;
    hrSampleActivities: number;
    dailyMetricDays: number;
  };
};

type Recommendation = {
  _id: string;
  title: string;
  description: string;
  severity: string;
  evidence: Array<{ metric: string; value: number | string; unit?: string }>;
  dataSufficiency: string;
};

type Vo2 = { available: boolean; points: Array<{ date: string; vo2Max?: number }> };
type HrTrends = {
  restingHeartRate: Array<{ date: string; restingHeartRateBpm?: number }>;
};

function greetingFor(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function OverviewPage() {
  const [username, setUsername] = useState("runner");
  const [data, setData] = useState<Overview | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [dq, setDq] = useState<DataQualitySummary | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [vo2, setVo2] = useState<Vo2 | null>(null);
  const [hr, setHr] = useState<HrTrends | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, overview, syncStatus, today, vo2Trend, hrTrends, quality] =
          await Promise.all([
            apiGet<{ username: string }>("/api/auth/me"),
            apiGet<Overview>("/api/v1/analytics/overview"),
            apiGet<SyncStatus>("/api/v1/sync/status"),
            apiGet<{ items: Recommendation[] }>("/api/v1/recommendations/today"),
            apiGet<Vo2>("/api/v1/analytics/vo2max"),
            apiGet<HrTrends>("/api/v1/analytics/heart-rate"),
            apiGet<DataQualitySummary>("/api/v1/data-quality/overview"),
          ]);
        if (cancelled) return;
        setUsername(me.username);
        setData(overview);
        setSync(syncStatus);
        setDq(quality);
        setRecs(today.items);
        setVo2(vo2Trend);
        setHr(hrTrends);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load home");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayKey = now.toISOString().slice(0, 10);
  const todaysRuns =
    data?.recentActivities.filter(
      (a) => new Date(a.startedAt).toISOString().slice(0, 10) === todayKey
    ) ?? [];

  const latestVo2 =
    vo2?.available && vo2.points.length
      ? vo2.points[vo2.points.length - 1]
      : null;

  const latestRhr = hr?.restingHeartRate.length
    ? [...hr.restingHeartRate].reverse().find((d) => d.restingHeartRateBpm != null)
    : null;

  const weekDistance =
    data?.weeklyDistanceTrend[data.weeklyDistanceTrend.length - 1]
      ?.distanceMeters ?? 0;

  const milestones = useMemo(() => {
    if (!data?.recentActivities.length) return [];
    const withDistance = data.recentActivities.filter(
      (a) => typeof a.distanceMeters === "number"
    );
    const longest = [...withDistance].sort(
      (a, b) => (b.distanceMeters ?? 0) - (a.distanceMeters ?? 0)
    )[0];
    const withPace = data.recentActivities.filter(
      (a) => typeof a.averagePaceSecPerKm === "number"
    );
    const fastest = [...withPace].sort(
      (a, b) => (a.averagePaceSecPerKm ?? 0) - (b.averagePaceSecPerKm ?? 0)
    )[0];
    const items = [];
    if (longest) {
      items.push({
        label: "Longest recent run",
        value: formatDistance(longest.distanceMeters, "km"),
      });
    }
    if (fastest) {
      items.push({
        label: "Fastest recent pace",
        value: formatPace(fastest.averagePaceSecPerKm, "min/km"),
      });
    }
    items.push({
      label: "Runs in view",
      value: String(data.activityCount),
    });
    return items;
  }, [data]);

  return (
    <div>
      <div className="mb-6">
        <p className="section-label">
          {now.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-2 text-[clamp(1.9rem,5vw,2.75rem)] font-extrabold tracking-tight">
          {greetingFor(now)}, {username}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--muted)] sm:text-base">
          Your running snapshot from Garmin. Missing numbers stay unavailable.
        </p>
        {dq ? (
          <Link
            href="/data-quality"
            className="mt-4 flex flex-wrap items-center gap-2 rounded-[1rem] border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-3 text-xs sm:text-sm"
          >
            <Badge
              tone={
                dq.summary.featuresBlocked > 0 ||
                dq.summary.dailyMetricDays === 0
                  ? "warning"
                  : "accent"
              }
            >
              Data quality
            </Badge>
            <span className="text-[var(--muted)]">
              Activities {dq.summary.activitySyncStatus} · Health{" "}
              {dq.summary.healthSyncStatus} · daily days{" "}
              {dq.summary.dailyMetricDays} · HR samples{" "}
              {dq.summary.hrSampleActivities}
            </span>
          </Link>
        ) : sync?.lastSuccessfulSyncAt ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Last sync {new Date(sync.lastSuccessfulSyncAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {loading ? <LoadingState label="Loading your home…" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && data ? (
        <div className="space-y-5">
          <Panel hero>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-label">Today</p>
                <p className="mt-2 text-2xl font-extrabold sm:text-3xl">
                  {todaysRuns.length
                    ? `${todaysRuns.length} run${todaysRuns.length > 1 ? "s" : ""} logged`
                    : "No run logged yet"}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {todaysRuns.length
                    ? formatDistance(
                        todaysRuns.reduce(
                          (sum, r) => sum + (r.distanceMeters ?? 0),
                          0
                        ),
                        "km"
                      )
                    : "Lace up whenever you're ready. Week-to-date is below."}
                </p>
              </div>
              <Badge tone="accent">
                Synced{" "}
                {sync?.lastSuccessfulSyncAt
                  ? new Date(sync.lastSuccessfulSyncAt).toLocaleString()
                  : "never"}
              </Badge>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel hero className="lg:col-span-1">
              <p className="section-label">VO2 Max</p>
              <p className="metric-figure mt-3 text-5xl font-extrabold text-[var(--accent)]">
                {latestVo2?.vo2Max != null ? latestVo2.vo2Max : "n/a"}
              </p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                {latestVo2
                  ? `Latest Garmin value · ${latestVo2.date}`
                  : "Unavailable until Garmin supplies VO2 Max for your account."}
              </p>
            </Panel>

            <Panel>
              <p className="section-label">This week’s distance</p>
              <p className="metric-figure mt-3 text-4xl font-extrabold">
                {formatDistance(weekDistance, "km")}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                From your latest weekly bucket
              </p>
            </Panel>

            <Panel>
              <p className="section-label">Resting heart rate</p>
              <p className="metric-figure mt-3 text-4xl font-extrabold">
                {latestRhr?.restingHeartRateBpm != null
                  ? `${Math.round(latestRhr.restingHeartRateBpm)}`
                  : "n/a"}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {latestRhr?.restingHeartRateBpm != null
                  ? `bpm · ${latestRhr.date}`
                  : "Unavailable until health sync provides resting HR."}
              </p>
            </Panel>
          </div>

          <Panel>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="section-label">Today’s game plan</p>
                <h2 className="mt-1 text-lg font-bold">Recommendation</h2>
              </div>
              <Link
                href="/coach"
                className="text-sm font-semibold text-[var(--accent)]"
              >
                See all
              </Link>
            </div>
            {recs.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No active recommendations. Evaluate rules when you have enough history.
              </p>
            ) : (
              <div className="space-y-3">
                {recs.slice(0, 1).map((r) => (
                  <div
                    key={r._id}
                    className="rounded-[1.1rem] border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="accent">{r.severity}</Badge>
                      <Badge>{r.dataSufficiency}</Badge>
                    </div>
                    <p className="mt-3 text-lg font-bold">{r.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                      {r.description}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm">
                      {r.evidence.map((e, idx) => (
                        <li key={`${e.metric}-${idx}`} className="metric-figure">
                          {e.metric}: {String(e.value)}
                          {e.unit ? ` ${e.unit}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-5">
            <Panel className="lg:col-span-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Weekly running</h2>
                <Badge tone="accent">28d</Badge>
              </div>
              <DistanceTrendChart data={data.weeklyDistanceTrend} />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="section-label">Distance</p>
                  <p className="metric-figure mt-1 font-bold">
                    {formatDistance(data.totalDistanceMeters, "km")}
                  </p>
                </div>
                <div>
                  <p className="section-label">Time</p>
                  <p className="metric-figure mt-1 font-bold">
                    {formatDuration(data.totalDurationSeconds)}
                  </p>
                </div>
                <div>
                  <p className="section-label">Runs</p>
                  <p className="metric-figure mt-1 font-bold">
                    {data.activityCount}
                  </p>
                </div>
                <div>
                  <p className="section-label">Avg pace</p>
                  <p className="metric-figure mt-1 font-bold">
                    {formatPace(data.averagePaceSecPerKm, "min/km")}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel className="lg:col-span-2">
              <h2 className="text-lg font-bold">Personal milestones</h2>
              {milestones.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Milestones appear after you sync runs.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {milestones.map((m) => (
                    <li
                      key={m.label}
                      className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface-raised)]/50 p-3"
                    >
                      <p className="section-label">{m.label}</p>
                      <p className="metric-figure mt-1 text-xl font-bold">
                        {m.value}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent runs</h2>
              <Link
                href="/activities"
                className="text-sm font-semibold text-[var(--accent)]"
              >
                My Activities
              </Link>
            </div>
            {data.recentActivities.length === 0 ? (
              <EmptyState
                title="No runs yet"
                body="Connect Garmin in Profile & Settings and sync. Your activities will show up here."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.recentActivities.slice(0, 4).map((a) => (
                  <RunCard
                    key={a._id}
                    id={a._id}
                    name={a.activityName}
                    startedAt={a.startedAt}
                    distanceMeters={a.distanceMeters}
                    durationSeconds={a.durationSeconds}
                    averagePaceSecPerKm={a.averagePaceSecPerKm}
                    averageHeartRateBpm={a.averageHeartRateBpm}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
