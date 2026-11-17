"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RunCard } from "@/components/running/run-card";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/shared/ui";
import { apiGet } from "@/lib/client/api";

type Activity = {
  _id: string;
  activityName?: string;
  startedAt: string;
  distanceMeters?: number;
  durationSeconds?: number;
  averagePaceSecPerKm?: number;
  averageHeartRateBpm?: number;
};

export default function RunningPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiGet<{ items: Activity[] }>(
          "/api/v1/activities?type=running&limit=50"
        );
        if (!cancelled) setItems(data.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load runs");
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
        eyebrow="My Activities"
        title="Every step, saved"
        description="Distance, pace, time, and heart rate from your Garmin activities. Easy / moderate / intense labels use average HR when available."
        actions={
          <Link href="/activities/compare">
            <Button variant="ghost">Compare runs</Button>
          </Link>
        }
      />
      {loading ? <LoadingState label="Loading your runs…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error ? (
        items.length === 0 ? (
          <EmptyState
            title="No runs stored"
            body="After Garmin sync succeeds, your activities land here as cards."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((a) => (
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
        )
      ) : null}
    </div>
  );
}
