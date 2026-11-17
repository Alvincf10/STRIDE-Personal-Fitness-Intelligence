"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Panel,
  Select,
} from "@/components/shared/ui";
import { apiGet, apiSend } from "@/lib/client/api";
import { formatDistance, formatDuration } from "@/lib/utils/units";

type GoalProgress = {
  goal: {
    _id: string;
    type: string;
    title: string;
    status: string;
    targetDistanceMeters?: number;
    targetTimeSeconds?: number;
  };
  progress: {
    estimateSeconds?: number;
    estimateRangeSeconds?: { low: number; high: number } | null;
    method?: string;
    confidence: string;
    note: string;
    bestDistanceMeters?: number;
    factors?: Array<{
      id: string;
      label: string;
      status: string;
      value: string;
    }>;
    evidence?: {
      comparableRuns: number;
      coverageRatio: number;
      volume28dKm: number;
      runDays28: number;
    };
  };
};

export default function GoalsRacesPage() {
  const [items, setItems] = useState<GoalProgress[]>([]);
  const [title, setTitle] = useState("Next 5K");
  const [type, setType] = useState("5k");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet<GoalProgress[]>("/api/v1/goals/progress");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load goals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiSend("/api/v1/goals", "POST", { type, title });
      setTitle("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create goal");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Goals & Races"
        title="Aim with evidence"
        description="Set a distance goal. Predictions only appear when enough recent evidence exists, with method and uncertainty shown."
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      <Panel className="mb-4">
        <h2 className="text-lg font-bold">New goal</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={onCreate}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title"
            required
          />
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="1k">1K</option>
            <option value="5k">5K</option>
            <option value="10k">10K</option>
            <option value="half_marathon">Half marathon</option>
            <option value="marathon">Marathon</option>
            <option value="custom">Custom</option>
          </Select>
          <Button type="submit">Create goal</Button>
        </form>
      </Panel>

      {!loading && items.length === 0 ? (
        <EmptyState
          title="No goals yet"
          body="Create a 5K or 10K goal to track progress against your real runs."
        />
      ) : (
        <div className="space-y-3">
          {items.map(({ goal, progress }) => (
            <Panel key={goal._id} hero>
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{goal.type}</Badge>
                <Badge>{goal.status}</Badge>
                <Badge tone="warning">{progress.confidence}</Badge>
              </div>
              <h2 className="mt-3 text-xl font-extrabold">{goal.title}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Target{" "}
                {formatDistance(goal.targetDistanceMeters, "km")}
                {goal.targetTimeSeconds
                  ? ` · ${formatDuration(goal.targetTimeSeconds)}`
                  : ""}
              </p>
              <div className="mt-4 rounded-[1rem] border border-[var(--border)] bg-[var(--surface)]/60 p-3 text-sm">
                <p className="section-label">Estimate</p>
                <p className="metric-figure mt-2 text-2xl font-bold">
                  {progress.estimateRangeSeconds
                    ? `${formatDuration(progress.estimateRangeSeconds.low)} – ${formatDuration(progress.estimateRangeSeconds.high)}`
                    : "Withheld"}
                </p>
                <p className="mt-2 text-[var(--muted)]">{progress.note}</p>
                {progress.method ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Method: {progress.method}
                  </p>
                ) : null}
                {progress.bestDistanceMeters != null ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Evidence run: {formatDistance(progress.bestDistanceMeters, "km")}
                  </p>
                ) : null}
                {progress.factors?.length ? (
                  <ul className="mt-3 space-y-1 text-xs">
                    {progress.factors.map((f) => (
                      <li key={f.id} className="flex justify-between gap-2">
                        <span>
                          {f.label}{" "}
                          <Badge
                            tone={
                              f.status === "ok"
                                ? "accent"
                                : f.status === "weak"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {f.status}
                          </Badge>
                        </span>
                        <span className="metric-figure text-[var(--muted)]">
                          {f.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
