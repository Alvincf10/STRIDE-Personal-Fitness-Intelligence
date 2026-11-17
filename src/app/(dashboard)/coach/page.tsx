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
import { apiGet, apiSend } from "@/lib/client/api";
import { formatDistance } from "@/lib/utils/units";

type DailySuggestion = {
  ruleId: string;
  ruleVersion: string;
  workoutType: string;
  title: string;
  description: string;
  suggestedDistanceKm?: { min: number; max: number };
  suggestedDurationMinutes?: { min: number; max: number };
  suggestedZone?: string;
  severity: string;
  dataSufficiency: string;
  confidence: string;
  evidence: Array<{ metric: string; value: number | string; unit?: string }>;
  generatedAt: string;
};

type CalendarDay = {
  date: string;
  completed: Array<{
    id: string;
    name?: string;
    distanceMeters?: number;
    durationSeconds?: number;
  }>;
  planned: { workoutType: string; title: string; source: string };
  evaluation: string;
  evaluationNote: string;
};

type CalendarResponse = {
  suggestion: DailySuggestion;
  secondaryInsights: Array<{
    _id: string;
    ruleId: string;
    title: string;
    description: string;
    severity: string;
  }>;
  calendar: CalendarDay[];
  evaluationSummary: {
    matched: number;
    restKept: number;
    missed: number;
    unplanned: number;
    adherencePct: number | null;
    calculationVersion: string;
  };
};

const EVIDENCE_LABELS: Record<string, string> = {
  recoveryStatus: "Recovery status",
  currentWeekKm: "This week",
  previousWeekKm: "Last week",
  daysSinceLastRun: "Days since last run",
  ranToday: "Already ran today",
  weeklyDistanceBaselineKm: "Your weekly baseline",
  currentKm: "This week",
  previousKm: "Last week",
  changePercent: "Week-over-week change",
  formScore: "Form (CTL−ATL)",
  zone2Percent14d: "Zone 2 share (14d)",
};

const SKIP_EVIDENCE = new Set(["currentKm", "previousKm"]); // duplicates of week totals

function formatEvidenceValue(
  metric: string,
  value: number | string,
  unit?: string
) {
  if (metric === "ranToday") {
    return value === "yes" ? "Yes" : "No";
  }
  if (metric === "recoveryStatus") {
    return String(value).replaceAll("_", " ");
  }
  if (metric === "changePercent" && typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 500) {
      return "n/a (last week too small to compare)";
    }
    return `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;
  }
  if (typeof value === "number" && unit === "km") {
    return `${value.toFixed(1)} km`;
  }
  if (typeof value === "number" && unit === "days") {
    return `${value} day${value === 1 ? "" : "s"}`;
  }
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function evalLabel(evaluation: string) {
  switch (evaluation) {
    case "matched":
      return "On plan";
    case "missed":
      return "Missed";
    case "rest_kept":
      return "Rest kept";
    case "unplanned":
      return "Extra run";
    default:
      return evaluation.replaceAll("_", " ");
  }
}

function workoutLabel(type: string) {
  return type.replaceAll("_", " ");
}

export default function CoachPage() {
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const calendar = await apiGet<CalendarResponse>(
        "/api/v1/coach/calendar?days=14"
      );
      setData(calendar);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coach");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function refreshRules() {
    setBusy(true);
    try {
      await apiSend("/api/v1/recommendations/evaluate", "POST");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }

  const suggestion = data?.suggestion;
  const evidenceRows =
    suggestion?.evidence.filter((e) => !SKIP_EVIDENCE.has(e.metric)) ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Coach"
        title="Today's training suggestion"
        description="A simple plan from your recovery and recent volume. Not medical advice."
        actions={
          <Button onClick={refreshRules} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {suggestion ? (
        <div className="space-y-5">
          <Panel hero>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{workoutLabel(suggestion.workoutType)}</Badge>
              <Badge
                tone={
                  suggestion.dataSufficiency === "sufficient"
                    ? "accent"
                    : "warning"
                }
              >
                {suggestion.dataSufficiency === "sufficient"
                  ? "Enough data"
                  : "Thin data"}
              </Badge>
              <Badge>
                {suggestion.confidence === "high"
                  ? "High confidence"
                  : suggestion.confidence === "medium"
                    ? "Medium confidence"
                    : "Low confidence"}
              </Badge>
            </div>

            <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {suggestion.title}
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--muted)]">
              {suggestion.description}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--ink)]/35 px-4 py-4">
                <p className="section-label">Distance</p>
                <p className="metric-figure mt-2 text-2xl font-extrabold text-[var(--accent)]">
                  {suggestion.suggestedDistanceKm
                    ? `${suggestion.suggestedDistanceKm.min}–${suggestion.suggestedDistanceKm.max} km`
                    : "—"}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--ink)]/35 px-4 py-4">
                <p className="section-label">Duration</p>
                <p className="metric-figure mt-2 text-2xl font-extrabold">
                  {suggestion.suggestedDurationMinutes
                    ? `${suggestion.suggestedDurationMinutes.min}–${suggestion.suggestedDurationMinutes.max} min`
                    : "—"}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--ink)]/35 px-4 py-4">
                <p className="section-label">Effort</p>
                <p className="metric-figure mt-2 text-2xl font-extrabold">
                  {suggestion.suggestedZone ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="section-label">Why this suggestion</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {evidenceRows.map((e, idx) => (
                  <li
                    key={`${e.metric}-${idx}`}
                    className="flex items-baseline justify-between gap-3 rounded-[1rem] border border-[var(--border)]/80 px-4 py-3"
                  >
                    <span className="text-sm text-[var(--muted)]">
                      {EVIDENCE_LABELS[e.metric] ?? e.metric}
                    </span>
                    <span className="metric-figure text-sm font-semibold">
                      {formatEvidenceValue(e.metric, e.value, e.unit)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Rule {suggestion.ruleId}
              </p>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">This week</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Planned day vs what you actually ran.
            </p>
            {data?.evaluationSummary ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1rem] border border-[var(--border)] px-4 py-3">
                  <p className="section-label">Adherence</p>
                  <p className="metric-figure mt-1 text-2xl font-extrabold text-[var(--accent)]">
                    {data.evaluationSummary.adherencePct == null
                      ? "—"
                      : `${data.evaluationSummary.adherencePct}%`}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-[var(--border)] px-4 py-3">
                  <p className="section-label">On plan</p>
                  <p className="metric-figure mt-1 text-2xl font-extrabold">
                    {data.evaluationSummary.matched}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-[var(--border)] px-4 py-3">
                  <p className="section-label">Missed</p>
                  <p className="metric-figure mt-1 text-2xl font-extrabold">
                    {data.evaluationSummary.missed}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-[var(--border)] px-4 py-3">
                  <p className="section-label">Rest kept</p>
                  <p className="metric-figure mt-1 text-2xl font-extrabold">
                    {data.evaluationSummary.restKept}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {data?.calendar.map((day) => (
                <div
                  key={day.date}
                  className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface-raised)]/35 p-3"
                  title={day.evaluationNote}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold">{day.date.slice(5)}</p>
                    <Badge
                      tone={
                        day.evaluation === "missed"
                          ? "warning"
                          : day.evaluation === "matched" ||
                              day.evaluation === "rest_kept"
                            ? "accent"
                            : "neutral"
                      }
                    >
                      {evalLabel(day.evaluation)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Plan · {workoutLabel(day.planned.workoutType)}
                  </p>
                  {day.completed.length === 0 ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">No run</p>
                  ) : (
                    day.completed.map((c) => (
                      <Link
                        key={c.id}
                        href={`/activities/${c.id}`}
                        className="mt-2 block text-sm font-medium text-[var(--text)] hover:text-[var(--accent)]"
                      >
                        {c.name || "Run"} ·{" "}
                        {formatDistance(c.distanceMeters, "km")}
                      </Link>
                    ))
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Other notes</h2>
            {!data?.secondaryInsights.length ? (
              <div className="mt-3">
                <EmptyState
                  title="Nothing else right now"
                  body="More notes appear once weekly history is denser."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.secondaryInsights.map((item) => (
                  <li
                    key={item._id}
                    className="rounded-[1.1rem] border border-[var(--border)] px-4 py-4"
                  >
                    <Badge>{item.severity}</Badge>
                    <p className="mt-2 font-bold">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {item.description}
                    </p>
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
