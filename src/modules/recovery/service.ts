import { connectMongo } from "@/lib/database/mongoose";
import { DailyMetrics } from "@/models";
import { getLatestBaselines } from "@/modules/personal-intelligence/baselines";

export async function getRecoveryOverview() {
  await connectMongo();
  const recent = await DailyMetrics.find()
    .sort({ date: -1 })
    .limit(14)
    .lean();
  const baselines = await getLatestBaselines();
  const rhrBaseline = baselines.find((b) => b.metric === "resting_hr");
  const hrvBaseline = baselines.find((b) => b.metric === "hrv");
  const latest = recent[0];

  const factors: Array<{
    metric: string;
    status: "ok" | "attention" | "insufficient";
    value?: number | string;
    note: string;
  }> = [];

  if (!latest) {
    return {
      status: "insufficient_data" as const,
      label: "Insufficient recovery data",
      factors: [],
      recent,
      baselines,
    };
  }

  if (typeof latest.restingHeartRateBpm === "number" && rhrBaseline) {
    const elevated = latest.restingHeartRateBpm > rhrBaseline.value + 5;
    factors.push({
      metric: "resting_hr",
      status: elevated ? "attention" : "ok",
      value: latest.restingHeartRateBpm,
      note: elevated
        ? `Above personal median baseline (${rhrBaseline.value.toFixed(0)} bpm)`
        : `Near personal median baseline (${rhrBaseline.value.toFixed(0)} bpm)`,
    });
  } else {
    factors.push({
      metric: "resting_hr",
      status: "insufficient",
      note: "Need resting HR samples and a baseline (≥7 days).",
    });
  }

  if (typeof latest.hrvMs === "number" && hrvBaseline) {
    const low = latest.hrvMs < hrvBaseline.value * 0.9;
    factors.push({
      metric: "hrv",
      status: low ? "attention" : "ok",
      value: latest.hrvMs,
      note: low
        ? `Below personal median baseline (${hrvBaseline.value.toFixed(0)} ms)`
        : `Near personal median baseline (${hrvBaseline.value.toFixed(0)} ms)`,
    });
  } else {
    factors.push({
      metric: "hrv",
      status: "insufficient",
      note: "Need HRV samples and a baseline (≥7 days).",
    });
  }

  if (typeof latest.sleepDurationSeconds === "number") {
    factors.push({
      metric: "sleep",
      status: latest.sleepDurationSeconds >= 6 * 3600 ? "ok" : "attention",
      value: latest.sleepDurationSeconds,
      note: "Compared with a simple 6h floor until a personal sleep baseline exists.",
    });
  } else {
    factors.push({
      metric: "sleep",
      status: "insufficient",
      note: "Sleep duration unavailable for the latest day.",
    });
  }

  const attention = factors.filter((f) => f.status === "attention").length;
  const ok = factors.filter((f) => f.status === "ok").length;
  const insufficient = factors.filter((f) => f.status === "insufficient").length;

  let status: "ok" | "attention" | "easier_session" | "insufficient_data" =
    "insufficient_data";
  let label = "Insufficient recovery data";
  if (ok + attention === 0) {
    status = "insufficient_data";
    label = "Insufficient recovery data";
  } else if (attention >= 2) {
    status = "easier_session";
    label = "Consider an easier session";
  } else if (attention === 1) {
    status = "attention";
    label = "Recovery indicators need attention";
  } else if (insufficient < factors.length) {
    status = "ok";
    label = "Recovery indicators look consistent with baseline";
  }

  return {
    status,
    label,
    disclaimer:
      "Informational only. Not a medical diagnosis or readiness determination.",
    latestDate: latest.date,
    factors,
    recent,
    baselines,
  };
}
