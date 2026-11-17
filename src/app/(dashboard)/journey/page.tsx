"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/shared/ui";
import { apiGet } from "@/lib/client/api";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "@/lib/utils/units";

type JourneyOverview = {
  streakDays: number;
  streakDefinition: string;
  totalRuns: number;
  totalDistanceMeters: number;
  longestRun: {
    id: string;
    startedAt: string;
    distanceMeters?: number;
    activityName?: string;
  } | null;
  heatmap: Array<{ date: string; count: number }>;
  achievements: Array<{
    _id: string;
    achievementId: string;
    title: string;
    description: string;
    unlockedAt: string;
  }>;
};

type MonthlyWrapped = {
  period: string;
  calculationVersion: string;
  activityCount: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  averagePaceSecPerKm?: number;
  longestRun: {
    id: string;
    activityName?: string;
    distanceMeters?: number;
    startedAt: string;
  } | null;
  fastestRun: {
    id: string;
    activityName?: string;
    averagePaceSecPerKm?: number;
    startedAt: string;
  } | null;
  healthDaysWithSleep: number;
  runDays: number;
  monthlyDistanceMeters?: Array<{ month: string; distanceMeters: number }>;
};

export default function JourneyPage() {
  const [data, setData] = useState<JourneyOverview | null>(null);
  const [wrapped, setWrapped] = useState<MonthlyWrapped | null>(null);
  const [annual, setAnnual] = useState<MonthlyWrapped | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [overview, month, year] = await Promise.all([
          apiGet<JourneyOverview>("/api/v1/journey/overview"),
          apiGet<MonthlyWrapped>("/api/v1/journey/wrapped"),
          apiGet<MonthlyWrapped>("/api/v1/journey/wrapped/annual"),
        ]);
        if (cancelled) return;
        setData(overview);
        setWrapped(month);
        setAnnual(year);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load journey");
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

  return (
    <div>
      <PageHeader
        eyebrow="My Journey"
        title="Progress you can feel"
        description="Streaks, monthly wrapped, heatmap, and achievements from real activity history."
        actions={
          <Link href="/journey/report">
            <Button variant="ghost">Weekly report</Button>
          </Link>
        }
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel hero>
              <p className="section-label">Run streak</p>
              <p className="metric-figure mt-3 text-4xl font-extrabold text-[var(--accent)]">
                {data.streakDays}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {data.streakDefinition}
              </p>
            </Panel>
            <Panel>
              <p className="section-label">Total runs</p>
              <p className="metric-figure mt-3 text-4xl font-extrabold">
                {data.totalRuns}
              </p>
            </Panel>
            <Panel>
              <p className="section-label">Total distance</p>
              <p className="metric-figure mt-3 text-3xl font-extrabold">
                {formatDistance(data.totalDistanceMeters, "km")}
              </p>
            </Panel>
          </div>

          {wrapped ? (
            <Panel hero>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Monthly wrapped</h2>
                <Badge tone="accent">{wrapped.period}</Badge>
                <Badge>v{wrapped.calculationVersion}</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="section-label">Distance</p>
                  <p className="metric-figure mt-1 text-xl font-bold">
                    {formatDistance(wrapped.totalDistanceMeters, "km")}
                  </p>
                </div>
                <div>
                  <p className="section-label">Time</p>
                  <p className="metric-figure mt-1 text-xl font-bold">
                    {formatDuration(wrapped.totalDurationSeconds)}
                  </p>
                </div>
                <div>
                  <p className="section-label">Runs / days</p>
                  <p className="metric-figure mt-1 text-xl font-bold">
                    {wrapped.activityCount} / {wrapped.runDays}
                  </p>
                </div>
                <div>
                  <p className="section-label">Avg pace</p>
                  <p className="metric-figure mt-1 text-xl font-bold">
                    {formatPace(wrapped.averagePaceSecPerKm, "min/km")}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-[var(--border)] p-3">
                  <p className="section-label">Longest this month</p>
                  {wrapped.longestRun ? (
                    <Link
                      href={`/activities/${wrapped.longestRun.id}`}
                      className="mt-2 block hover:text-[var(--accent)]"
                    >
                      <p className="font-semibold">
                        {wrapped.longestRun.activityName || "Run"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {formatDistance(
                          wrapped.longestRun.distanceMeters,
                          "km"
                        )}
                      </p>
                    </Link>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--muted)]">No runs</p>
                  )}
                </div>
                <div className="rounded-[1rem] border border-[var(--border)] p-3">
                  <p className="section-label">Fastest this month</p>
                  {wrapped.fastestRun ? (
                    <Link
                      href={`/activities/${wrapped.fastestRun.id}`}
                      className="mt-2 block hover:text-[var(--accent)]"
                    >
                      <p className="font-semibold">
                        {wrapped.fastestRun.activityName || "Run"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {formatPace(
                          wrapped.fastestRun.averagePaceSecPerKm,
                          "min/km"
                        )}
                      </p>
                    </Link>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--muted)]">No runs</p>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Sleep nights logged: {wrapped.healthDaysWithSleep}
              </p>
            </Panel>
          ) : null}

          {annual ? (
            <Panel>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">Annual wrapped</h2>
                <Badge tone="accent">{annual.period}</Badge>
                <Badge>v{annual.calculationVersion}</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="section-label">Distance</p>
                  <p className="metric-figure mt-1 text-xl font-bold">
                    {formatDistance(annual.totalDistanceMeters, "km")}
                  </p>
                </div>
                <div>
                  <p className="section-label">Time</p>
                  <p className="metric-figure mt-1 text-xl font-bold">
                    {formatDuration(annual.totalDurationSeconds)}
                  </p>
                </div>
                <div>
                  <p className="section-label">Runs / days</p>
                  <p className="metric-figure mt-1 text-xl font-bold">
                    {annual.activityCount} / {annual.runDays}
                  </p>
                </div>
                <div>
                  <p className="section-label">Avg pace</p>
                  <p className="metric-figure mt-1 text-xl font-bold">
                    {formatPace(annual.averagePaceSecPerKm, "min/km")}
                  </p>
                </div>
              </div>
              {annual.monthlyDistanceMeters?.length ? (
                <ul className="mt-4 space-y-1 text-sm">
                  {annual.monthlyDistanceMeters.map((m) => (
                    <li
                      key={m.month}
                      className="flex justify-between rounded-[0.75rem] border border-[var(--border)] px-3 py-2"
                    >
                      <span>{m.month}</span>
                      <span className="metric-figure">
                        {formatDistance(m.distanceMeters, "km")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          ) : null}

          <Panel>
            <h2 className="text-lg font-bold">Longest run</h2>
            {!data.longestRun ? (
              <p className="mt-2 text-sm text-[var(--muted)]">No runs yet.</p>
            ) : (
              <Link
                href={`/activities/${data.longestRun.id}`}
                className="mt-3 block rounded-[1rem] border border-[var(--border)] px-4 py-3"
              >
                <p className="font-semibold">
                  {data.longestRun.activityName || "Run"}
                </p>
                <p className="metric-figure text-sm text-[var(--muted)]">
                  {formatDistance(data.longestRun.distanceMeters, "km")} ·{" "}
                  {new Date(data.longestRun.startedAt).toLocaleString()}
                </p>
              </Link>
            )}
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Activity heatmap</h2>
            {!data.heatmap.length ? (
              <div className="mt-3">
                <EmptyState
                  title="No heatmap yet"
                  body="Synced runs will light up calendar days here."
                />
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {data.heatmap.slice(0, 90).map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.count} run(s)`}
                    className="h-4 w-4 rounded-sm"
                    style={{
                      background:
                        d.count >= 2
                          ? "#B8FF3C"
                          : "color-mix(in srgb, #B8FF3C 45%, #15261E)",
                    }}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Achievements</h2>
            {!data.achievements.length ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                First stride, 5K, 10K, 50/100 km, and three run days unlock as you go.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.achievements.map((a) => (
                  <li
                    key={a._id}
                    className="rounded-[1rem] border border-[var(--border)] px-4 py-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="accent">{a.achievementId}</Badge>
                      <Badge>
                        {new Date(a.unlockedAt).toLocaleDateString()}
                      </Badge>
                    </div>
                    <p className="mt-2 font-bold">{a.title}</p>
                    <p className="text-sm text-[var(--muted)]">{a.description}</p>
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
