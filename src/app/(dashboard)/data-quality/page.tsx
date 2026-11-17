"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from "@/components/shared/ui";
import { apiGet, apiSend } from "@/lib/client/api";

type Overview = {
  summary: {
    connectionStatus: string;
    activitySyncStatus: string;
    healthSyncStatus: string;
    lastActivitySyncAt: string | null;
    lastHealthSyncAt: string | null;
    runningActivities: number;
    dailyMetricDays: number;
    hrSampleActivities: number;
    featuresReady: number;
    featuresLimited: number;
    featuresBlocked: number;
  };
  syncHealth: {
    activities: {
      status: string;
      lastSuccessfulAt: string | null;
      lastAttemptAt: string | null;
      recordsFetched: number;
      errorMessage: string | null;
    };
    health: {
      status: string;
      lastSuccessfulAt: string | null;
      lastAttemptAt: string | null;
      recordsFetched: number;
      errorMessage: string | null;
    };
  };
  coverage: {
    activityCoverage: {
      withAverageHrPct: number | null;
      withHrSamplesPct: number | null;
      withGpsPct: number | null;
      withLapsPct: number | null;
    };
    metrics: Array<{
      metricKey: string;
      label: string;
      status: string;
      recordCount: number;
      explanation: string;
    }>;
  };
  capabilities: {
    items: Array<{
      endpointKey: string;
      label: string;
      probeStatus: string;
      dataStatus: string;
      sanitizedNote: string | null;
    }>;
  };
  readiness: Array<{
    featureId: string;
    label: string;
    status: string;
    sampleCount: number;
    minimumSampleCount: number;
    missingMetrics: string[];
    explanation: string;
  }>;
  calculationVersion: string;
};

const METRIC_HELP: Record<string, string> = {
  "activities.running": "Jumlah lari yang sudah masuk STRIDE.",
  "activities.hr_average": "Lari yang punya rata-rata denyut dari Garmin.",
  "activities.hr_samples":
    "Grafik HR/pace per detik — dipakai decoupling & detail run.",
  "activities.hr_zone_summary":
    "Waktu di Zone 1–5 dari Garmin (hrTimeInZone).",
  "activities.laps": "Split / interval dari Garmin.",
  "activities.gps": "Titik start/end atau track GPS.",
  "daily.rhr": "Denyut istirahat harian.",
  "daily.hrv": "HRV malam — sering kosong di Personal API.",
  "daily.sleep": "Durasi tidur harian.",
  "daily.stress": "Skor stress harian.",
  "daily.body_battery": "Body Battery terbaru per hari.",
  "daily.body_battery_series": "Grafik Body Battery sepanjang hari.",
  "daily.vo2max": "Estimasi VO2 Max dari Garmin.",
  "daily.steps": "Langkah harian.",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Ada data",
  partial: "Sebagian",
  empty: "Belum ada",
  ready: "Siap",
  limited: "Terbatas",
  insufficient_data: "Belum cukup",
  not_synced: "Belum sync",
  not_supported: "Tidak tersedia",
  success: "Sukses",
  failed: "Gagal",
  error: "Error",
  connected: "Terhubung",
};

function toneFor(status: string): "accent" | "warning" | "danger" | "neutral" {
  if (
    status === "available" ||
    status === "ready" ||
    status === "success" ||
    status === "connected"
  ) {
    return "accent";
  }
  if (
    status === "limited" ||
    status === "partial" ||
    status === "empty" ||
    status === "insufficient_data" ||
    status === "not_synced"
  ) {
    return "warning";
  }
  if (status === "failed" || status === "error") return "danger";
  return "neutral";
}

function fmt(iso: string | null) {
  if (!iso) return "Belum pernah";
  return new Date(iso).toLocaleString();
}

function groupMetrics(metrics: Overview["coverage"]["metrics"]) {
  const runs = metrics.filter((m) => m.metricKey.startsWith("activities."));
  const health = metrics.filter((m) => m.metricKey.startsWith("daily."));
  const other = metrics.filter(
    (m) =>
      !m.metricKey.startsWith("activities.") &&
      !m.metricKey.startsWith("daily.")
  );
  return { runs, health, other };
}

export default function DataQualityPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await apiGet<Overview>("/api/v1/data-quality/overview"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data quality");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function syncBoth() {
    setBusy(true);
    try {
      await apiSend("/api/v1/sync/activities", "POST");
      await apiSend("/api/v1/sync/health", "POST");
      await new Promise((r) => setTimeout(r, 2500));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const groups = useMemo(
    () => (data ? groupMetrics(data.coverage.metrics) : null),
    [data]
  );

  return (
    <div>
      <PageHeader
        eyebrow="Data Quality"
        title="Isi gudang data Garmin"
        description="Halaman ini bukan saran latihan. Ini checklist: data apa yang sudah masuk, mana yang kosong, dan fitur STRIDE mana yang boleh jalan."
        actions={
          <Button onClick={syncBoth} disabled={busy}>
            {busy ? "Syncing…" : "Sync sekarang"}
          </Button>
        }
      />
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <div className="space-y-5">
          <Panel hero>
            <p className="section-label">Ringkas</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {data.summary.runningActivities} lari ·{" "}
              {data.summary.dailyMetricDays} hari kesehatan
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              Endpoint Garmin bisa “hidup” tapi isi akunmu kosong — makanya ada
              halaman ini. Hijau = sudah ada di database STRIDE. Kuning = tipis /
              sebagian. Abu = belum ada.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--ink)]/30 px-4 py-4">
                <p className="section-label">Fitur siap</p>
                <p className="metric-figure mt-2 text-3xl font-extrabold text-[var(--accent)]">
                  {data.summary.featuresReady}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--ink)]/30 px-4 py-4">
                <p className="section-label">Terbatas</p>
                <p className="metric-figure mt-2 text-3xl font-extrabold">
                  {data.summary.featuresLimited}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--ink)]/30 px-4 py-4">
                <p className="section-label">Belum bisa</p>
                <p className="metric-figure mt-2 text-3xl font-extrabold">
                  {data.summary.featuresBlocked}
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Sync terakhir</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["activities", "health"] as const).map((key) => {
                const side = data.syncHealth[key];
                return (
                  <div
                    key={key}
                    className="rounded-[1.1rem] border border-[var(--border)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {key === "activities" ? "Aktivitas / lari" : "Kesehatan"}
                      </p>
                      <Badge tone={toneFor(side.status)}>
                        {STATUS_LABEL[side.status] ?? side.status}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-[var(--muted)]">
                      Sukses terakhir: {fmt(side.lastSuccessfulAt)}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      Percobaan terakhir: {fmt(side.lastAttemptAt)} ·{" "}
                      {side.recordsFetched} record
                    </p>
                    {side.errorMessage ? (
                      <p className="mt-2 text-sm text-[var(--warning)]">
                        {side.errorMessage}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-bold">Fitur STRIDE — siap atau belum?</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ini yang kamu pakai di Performance / Recovery / Coach. Kalau
              “belum cukup”, sync dulu atau lari lagi.
            </p>
            <ul className="mt-4 space-y-3">
              {data.readiness.map((f) => (
                <li
                  key={f.featureId}
                  className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface)]/35 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{f.label}</p>
                    <Badge tone={toneFor(f.status)}>
                      {STATUS_LABEL[f.status] ?? f.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {f.explanation}
                  </p>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Sampel {f.sampleCount}/{f.minimumSampleCount}
                    {f.missingMetrics.length
                      ? ` · kurang: ${f.missingMetrics.join(", ")}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          {groups ? (
            <>
              <MetricGroup
                title="Data lari"
                subtitle="Apa yang tersimpan dari aktivitas Garmin."
                metrics={groups.runs}
              />
              <MetricGroup
                title="Data kesehatan harian"
                subtitle="Sleep, stress, Body Battery, steps, dll."
                metrics={groups.health}
              />
              {groups.other.length ? (
                <MetricGroup
                  title="Lainnya"
                  subtitle="Metrik tambahan."
                  metrics={groups.other}
                />
              ) : null}
            </>
          ) : null}

          <Panel>
            <h2 className="text-lg font-bold">Endpoint vs isi akun</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              “Probe OK” hanya berarti Garmin menjawab. Kolom data bilang apakah
              STRIDE sudah menyimpan baris untukmu.
            </p>
            <ul className="mt-4 space-y-2">
              {data.capabilities.items.map((c) => (
                <li
                  key={c.endpointKey}
                  className="rounded-[1.1rem] border border-[var(--border)] px-4 py-3"
                >
                  <div className="flex flex-wrap gap-2">
                    <p className="font-semibold">{c.label}</p>
                    <Badge>
                      API {STATUS_LABEL[c.probeStatus] ?? c.probeStatus}
                    </Badge>
                    <Badge tone={toneFor(c.dataStatus)}>
                      Data {STATUS_LABEL[c.dataStatus] ?? c.dataStatus}
                    </Badge>
                  </div>
                  {c.sanitizedNote ? (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {c.sanitizedNote}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function MetricGroup({
  title,
  subtitle,
  metrics,
}: {
  title: string;
  subtitle: string;
  metrics: Overview["coverage"]["metrics"];
}) {
  if (!metrics.length) return null;
  return (
    <Panel>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      <ul className="mt-4 space-y-2">
        {metrics.map((m) => (
          <li
            key={m.metricKey}
            className="rounded-[1.1rem] border border-[var(--border)] px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{m.label}</p>
              <Badge tone={toneFor(m.status)}>
                {STATUS_LABEL[m.status] ?? m.status}
              </Badge>
              <span className="text-xs text-[var(--muted)]">
                {m.recordCount} record
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {METRIC_HELP[m.metricKey] ?? m.explanation}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
