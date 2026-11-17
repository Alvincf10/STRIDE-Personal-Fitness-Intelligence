"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { apiGet } from "@/lib/client/api";
import {
  formatDistance,
  formatDuration,
  formatPace,
} from "@/lib/utils/units";

type ActivityItem = {
  _id: string;
  activityName?: string;
  startedAt: string;
  distanceMeters?: number;
};

type CompareResponse = {
  left: Side;
  right: Side;
  delta: {
    distanceMeters: number | null;
    paceSecPerKm: number | null;
    averageHeartRateBpm: number | null;
  };
  note: string;
};

type Side = {
  activity: {
    id: string;
    activityName?: string;
    startedAt: string;
    distanceMeters: number | null;
    durationSeconds: number | null;
    averagePaceSecPerKm: number | null;
    averageHeartRateBpm: number | null;
    maxHeartRateBpm: number | null;
  };
  decoupling: {
    eligible: boolean;
    decouplingPercent: number | null;
  };
  sampleCount: number;
};

export default function CompareRunsPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await apiGet<{ items: ActivityItem[] }>(
          "/api/v1/activities?type=running&limit=30"
        );
        setItems(list.items);
        if (list.items[0]) setA(list.items[0]._id);
        if (list.items[1]) setB(list.items[1]._id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load runs");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function compare() {
    if (!a || !b || a === b) {
      setError("Pick two different runs.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(
        await apiGet<CompareResponse>(
          `/api/v1/activities/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Activities"
        title="Compare runs"
        description="Side-by-side distance, pace, HR, and decoupling when samples exist."
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading ? (
        <div className="space-y-4">
          <Panel>
            {items.length < 2 ? (
              <EmptyState
                title="Need at least two runs"
                body="Sync more activities before comparing."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="text-sm">
                  <span className="section-label">Run A</span>
                  <select
                    className="mt-2 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
                    value={a}
                    onChange={(e) => setA(e.target.value)}
                  >
                    {items.map((item) => (
                      <option key={item._id} value={item._id}>
                        {new Date(item.startedAt).toLocaleDateString()} ·{" "}
                        {item.activityName ?? "Run"} ·{" "}
                        {formatDistance(item.distanceMeters, "km")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="section-label">Run B</span>
                  <select
                    className="mt-2 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
                    value={b}
                    onChange={(e) => setB(e.target.value)}
                  >
                    {items.map((item) => (
                      <option key={item._id} value={item._id}>
                        {new Date(item.startedAt).toLocaleDateString()} ·{" "}
                        {item.activityName ?? "Run"} ·{" "}
                        {formatDistance(item.distanceMeters, "km")}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <Button onClick={compare} disabled={busy} className="w-full">
                    {busy ? "Comparing…" : "Compare"}
                  </Button>
                </div>
              </div>
            )}
          </Panel>

          {result ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <SideCard label="Run A" side={result.left} />
                <SideCard label="Run B" side={result.right} />
              </div>
              <Panel>
                <h2 className="text-lg font-bold">Delta (B − A)</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="Distance"
                    value={
                      result.delta.distanceMeters != null
                        ? `${result.delta.distanceMeters > 0 ? "+" : ""}${(
                            result.delta.distanceMeters / 1000
                          ).toFixed(2)} km`
                        : "—"
                    }
                  />
                  <MetricCard
                    label="Pace"
                    value={
                      result.delta.paceSecPerKm != null
                        ? `${result.delta.paceSecPerKm > 0 ? "+" : ""}${result.delta.paceSecPerKm.toFixed(0)} s/km`
                        : "—"
                    }
                  />
                  <MetricCard
                    label="Avg HR"
                    value={
                      result.delta.averageHeartRateBpm != null
                        ? `${result.delta.averageHeartRateBpm > 0 ? "+" : ""}${result.delta.averageHeartRateBpm.toFixed(0)} bpm`
                        : "—"
                    }
                  />
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">{result.note}</p>
              </Panel>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SideCard({ label, side }: { label: string; side: Side }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">{label}</h2>
        <Badge>{side.sampleCount} samples</Badge>
      </div>
      <Link
        href={`/activities/${side.activity.id}`}
        className="mt-2 block text-sm font-semibold text-[var(--accent)]"
      >
        {side.activity.activityName ?? "Run"} ·{" "}
        {new Date(side.activity.startedAt).toLocaleString()}
      </Link>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Distance"
          value={formatDistance(side.activity.distanceMeters ?? undefined, "km")}
        />
        <MetricCard
          label="Duration"
          value={formatDuration(side.activity.durationSeconds ?? undefined)}
        />
        <MetricCard
          label="Pace"
          value={formatPace(
            side.activity.averagePaceSecPerKm ?? undefined,
            "min/km"
          )}
        />
        <MetricCard
          label="Avg HR"
          value={
            side.activity.averageHeartRateBpm != null
              ? `${Math.round(side.activity.averageHeartRateBpm)}`
              : "—"
          }
        />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Decoupling:{" "}
        {side.decoupling.eligible && side.decoupling.decouplingPercent != null
          ? `${side.decoupling.decouplingPercent}%`
          : "n/a"}
      </p>
    </Panel>
  );
}
