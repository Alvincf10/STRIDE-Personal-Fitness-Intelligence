"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
} from "@/components/shared/ui";
import { apiGet } from "@/lib/client/api";
import { formatDuration, formatPace } from "@/lib/utils/units";

type WeeklyReport = {
  period: { label: string; start: string; end: string };
  running: {
    activityCount: number;
    distanceKm: number;
    durationSeconds: number;
    activities: Array<{
      id: string;
      name?: string;
      startedAt: string;
      distanceMeters: number | null;
      averagePaceSecPerKm: number | null;
    }>;
  };
  wellness: {
    days: number;
    avgBodyBattery: number | null;
    avgStress: number | null;
    avgSteps: number | null;
  };
  performance: {
    strideLoad7d: number;
    formScore: number;
    formAvailable?: boolean;
    zone2Percent: number | null;
  };
  coach: { title: string; workoutType: string; description: string };
  shareText: string;
};

export default function WeeklyReportPage() {
  const [data, setData] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setData(await apiGet<WeeklyReport>("/api/v1/reports/weekly"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function copyShare() {
    if (!data?.shareText) return;
    await navigator.clipboard.writeText(data.shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Journey"
        title="Weekly report"
        description="One-page summary of the last 7 days. Print or copy the share line."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={copyShare} disabled={!data}>
              {copied ? "Copied" : "Copy summary"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.print()}
              disabled={!data}
            >
              Print
            </Button>
          </div>
        }
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {data ? (
        <div className="space-y-4 print:space-y-3">
          <Panel hero>
            <Badge>{data.period.label}</Badge>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              {data.running.distanceKm.toFixed(1)} km ·{" "}
              {data.running.activityCount} runs
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {new Date(data.period.start).toLocaleDateString()} →{" "}
              {new Date(data.period.end).toLocaleDateString()}
            </p>
            <p className="mt-4 rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm">
              {data.shareText}
            </p>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Time on feet"
              value={formatDuration(data.running.durationSeconds)}
            />
            <MetricCard
              label="STRIDE load 7d"
              value={String(data.performance.strideLoad7d)}
            />
            <MetricCard
              label="Form"
              value={
                data.performance.formAvailable === false
                  ? "—"
                  : data.performance.formScore.toFixed(1)
              }
            />
            <MetricCard
              label="Zone 2"
              value={
                data.performance.zone2Percent != null
                  ? `${data.performance.zone2Percent}%`
                  : "—"
              }
            />
          </div>

          <Panel>
            <h2 className="text-lg font-bold">Wellness</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Avg Body Battery"
                value={
                  data.wellness.avgBodyBattery != null
                    ? String(data.wellness.avgBodyBattery)
                    : "—"
                }
              />
              <MetricCard
                label="Avg stress"
                value={
                  data.wellness.avgStress != null
                    ? String(data.wellness.avgStress)
                    : "—"
                }
              />
              <MetricCard
                label="Avg steps"
                value={
                  data.wellness.avgSteps != null
                    ? String(Math.round(data.wellness.avgSteps))
                    : "—"
                }
              />
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Coach snapshot</h2>
            <div className="mt-2">
              <Badge tone="accent">{data.coach.workoutType}</Badge>
            </div>
            <p className="mt-3 text-xl font-bold">{data.coach.title}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.coach.description}
            </p>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Runs this week</h2>
            <ul className="mt-4 space-y-2">
              {data.running.activities.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm"
                >
                  <span>
                    {new Date(a.startedAt).toLocaleDateString()} ·{" "}
                    {a.name ?? "Run"}
                  </span>
                  <span className="metric-figure font-semibold">
                    {a.distanceMeters != null
                      ? `${(a.distanceMeters / 1000).toFixed(2)} km`
                      : "—"}{" "}
                    · {formatPace(a.averagePaceSecPerKm ?? undefined, "min/km")}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
