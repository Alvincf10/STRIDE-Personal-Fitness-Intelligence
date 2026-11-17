"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Panel,
  Select,
} from "@/components/shared/ui";
import { apiGet, apiSend } from "@/lib/client/api";

type Settings = {
  timezone: string;
  distanceUnit: "km" | "mi";
  paceUnit: "min/km" | "min/mi";
  weeklyDistanceGoalKm?: number;
};

type GarminStatus = {
  status: string;
  lastSuccessfulSyncAt: string | null;
};

type SyncStatus = {
  lastSuccessfulSyncAt: string | null;
  last: {
    status: string;
    sanitizedErrorMessage?: string | null;
  } | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [garmin, setGarmin] = useState<GarminStatus | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [s, g, sy] = await Promise.all([
      apiGet<Settings>("/api/v1/settings"),
      apiGet<GarminStatus>("/api/v1/garmin/status"),
      apiGet<SyncStatus>("/api/v1/sync/status"),
    ]);
    setSettings(s);
    setGarmin(g);
    setSync(sy);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
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

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setMessage(null);
    try {
      const updated = await apiSend<Settings>("/api/v1/settings", "PATCH", {
        timezone: settings.timezone,
        distanceUnit: settings.distanceUnit,
        paceUnit: settings.paceUnit,
        weeklyDistanceGoalKm: settings.weeklyDistanceGoalKm ?? null,
      });
      setSettings(updated);
      setMessage("Preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function connectGarmin(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await apiSend("/api/v1/garmin/connect", "POST", { apiKey });
      setApiKey("");
      await refresh();
      setMessage("Garmin credentials stored encrypted. Test the connection next.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    }
  }

  async function testConnection() {
    setMessage(null);
    setError(null);
    try {
      await apiSend("/api/v1/garmin/test", "POST");
      setMessage("Connection looks good.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
      await refresh();
    }
  }

  async function disconnect() {
    await apiSend("/api/v1/garmin/disconnect", "DELETE");
    await refresh();
    setMessage("Garmin disconnected. Stored credentials removed.");
  }

  async function syncNow() {
    setMessage(null);
    setError(null);
    try {
      await apiSend("/api/v1/sync/activities", "POST");
      setMessage(
        "Activity sync queued (all Garmin activity types for multi-sport)."
      );
      setTimeout(() => {
        void refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    }
  }

  async function syncHealth() {
    setMessage(null);
    setError(null);
    try {
      await apiSend("/api/v1/sync/health", "POST");
      setMessage("Health sync queued (Body Battery, stress, sleep, steps).");
      setTimeout(() => {
        void refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health sync failed");
    }
  }

  async function parseStoredFits() {
    setMessage(null);
    setError(null);
    try {
      const result = await apiSend<{
        attempted: number;
        parsed: number;
        failed: number;
      }>("/api/v1/fit/parse", "POST", { all: true, limit: 50 });
      setMessage(
        `FIT parse: ${result.parsed}/${result.attempted} ok${
          result.failed ? ` · ${result.failed} failed` : ""
        }.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "FIT parse failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Profile & Settings"
        title="Make it yours"
        description="Garmin connection, timezone, units, and sync controls."
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {message ? (
        <p className="mb-4 text-sm font-medium text-[var(--accent)]" role="status">
          {message}
        </p>
      ) : null}

      {settings ? (
        <div className="space-y-4">
          <Panel>
            <h2 className="text-lg font-bold">Data Quality</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Sync freshness, metric coverage, and which analyses are ready.
            </p>
            <Link
              href="/data-quality"
              className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[var(--border)] px-4 text-sm font-semibold text-[var(--accent)]"
            >
              Open Data Quality Center
            </Link>
          </Panel>

          <Panel hero>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">Garmin connection</h2>
              <Badge
                tone={
                  garmin?.status === "connected"
                    ? "accent"
                    : garmin?.status === "error" || garmin?.status === "expired"
                      ? "danger"
                      : "neutral"
                }
              >
                {garmin?.status ?? "unknown"}
              </Badge>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Last successful sync:{" "}
              {sync?.lastSuccessfulSyncAt
                ? new Date(sync.lastSuccessfulSyncAt).toLocaleString()
                : "Never"}
            </p>
            {sync?.last?.status === "failed" ? (
              <p className="mt-2 text-sm text-[var(--danger)]">
                {sync.last.sanitizedErrorMessage}
              </p>
            ) : null}

            <form className="mt-4 space-y-3" onSubmit={connectGarmin}>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Personal API key</span>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Stored encrypted at rest"
                  required
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save credentials</Button>
                <Button type="button" variant="ghost" onClick={testConnection}>
                  Test connection
                </Button>
                <Button type="button" variant="ghost" onClick={syncNow}>
                  Sync activities
                </Button>
                <Button type="button" variant="ghost" onClick={syncHealth}>
                  Sync health
                </Button>
                <Button type="button" variant="ghost" onClick={parseStoredFits}>
                  Parse stored FITs
                </Button>
                <Button type="button" variant="danger" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <h2 className="mb-3 text-lg font-bold">Preferences</h2>
            <form className="space-y-3" onSubmit={saveSettings}>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Timezone</span>
                <Input
                  value={settings.timezone}
                  onChange={(e) =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Distance unit</span>
                <Select
                  value={settings.distanceUnit}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      distanceUnit: e.target.value as "km" | "mi",
                    })
                  }
                >
                  <option value="km">km</option>
                  <option value="mi">mi</option>
                </Select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">Pace unit</span>
                <Select
                  value={settings.paceUnit}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      paceUnit: e.target.value as "min/km" | "min/mi",
                    })
                  }
                >
                  <option value="min/km">min/km</option>
                  <option value="min/mi">min/mi</option>
                </Select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[var(--muted)]">
                  Weekly distance goal (km, optional)
                </span>
                <Input
                  type="number"
                  min={1}
                  step="0.1"
                  value={settings.weeklyDistanceGoalKm ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      weeklyDistanceGoalKm: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </label>
              <Button type="submit">Save preferences</Button>
            </form>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
