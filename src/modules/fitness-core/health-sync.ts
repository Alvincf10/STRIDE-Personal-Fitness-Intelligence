import { connectMongo } from "@/lib/database/mongoose";
import { DailyMetrics } from "@/models";
import type { GarminAdapter } from "@/modules/garmin/adapter";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function ymd(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

/** Unwrap common Garmin Personal API envelopes: array | { data } | named lists. */
export function extractRows(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return [];

  for (const key of keys) {
    const candidate = root[key];
    if (Array.isArray(candidate)) return candidate;
  }

  const nestedData = asRecord(root.data);
  if (Array.isArray(root.data)) return root.data;
  if (nestedData) {
    for (const key of keys) {
      const candidate = nestedData[key];
      if (Array.isArray(candidate)) return candidate;
    }
    const values = Object.values(nestedData);
    if (
      values.length &&
      values.every((v) => v && typeof v === "object" && !Array.isArray(v))
    ) {
      return values;
    }
  }

  return [];
}

function parseBodyBatterySeries(row: Record<string, unknown>) {
  const arr = Array.isArray(row.bodyBatteryValuesArray)
    ? row.bodyBatteryValuesArray
    : [];
  const points: Array<{ t: Date; v: number }> = [];
  for (const item of arr) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const ts = asNumber(item[0]);
    const level = asNumber(item[1]);
    if (ts == null || level == null) continue;
    points.push({ t: new Date(ts), v: level });
  }
  return points;
}

export async function syncHealthMetrics(adapter: GarminAdapter) {
  await connectMongo();
  const startDate = ymd(28);
  const endDate = ymd(0);
  let upserted = 0;

  const byDate = new Map<string, Record<string, unknown>>();

  const ensure = (date: string) => {
    if (!byDate.has(date)) byDate.set(date, { date, source: "garmin" });
    return byDate.get(date)!;
  };

  try {
    const summaries = await adapter.getDailySummaries(startDate, endDate);
    const rows = extractRows(summaries, [
      "dailySummaries",
      "userSummaries",
      "summaries",
      "days",
    ]);
    for (const row of rows) {
      const r = asRecord(row);
      if (!r) continue;
      const date =
        asString(r.calendarDate) ??
        asString(r.date) ??
        asString(r.startDate);
      if (!date) continue;
      const target = ensure(date);
      const heartRate = asRecord(r.heartRate);
      const stress = asRecord(r.stress);
      const bodyBattery = asRecord(r.bodyBattery);
      const movement = asRecord(r.movement);
      const steps = asRecord(movement?.steps);
      const floors = asRecord(movement?.floorsAscended);
      const intensity = asRecord(r.intensityMinutes);

      target.restingHeartRateBpm =
        asNumber(r.restingHeartRate) ??
        asNumber(r.restingHeartRateInBeatsPerMinute) ??
        asNumber(heartRate?.restingValue);
      target.averageHeartRateBpm =
        asNumber(r.averageHeartRate) ?? asNumber(heartRate?.avgValue);
      target.maxHeartRateBpm =
        asNumber(r.maxHeartRate) ?? asNumber(heartRate?.maxValue);
      target.minHeartRateBpm = asNumber(heartRate?.minValue);
      target.steps = asNumber(steps?.value) ?? asNumber(r.totalSteps) ?? asNumber(r.steps);
      target.stepsGoal = asNumber(steps?.goal);
      target.floorsAscended = asNumber(floors?.value);
      target.intensityMinutes =
        asNumber(intensity?.moderate) != null || asNumber(intensity?.vigorous) != null
          ? (asNumber(intensity?.moderate) ?? 0) +
            2 * (asNumber(intensity?.vigorous) ?? 0)
          : asNumber(r.intensityMinutes);
      target.stressLevel =
        asNumber(stress?.avgLevel) ??
        asNumber(r.averageStressLevel) ??
        asNumber(r.stressLevel);
      target.stressMaxLevel = asNumber(stress?.maxLevel);
      target.bodyBattery =
        asNumber(bodyBattery?.latestValue) ??
        asNumber(r.bodyBatteryMostRecentValue) ??
        asNumber(r.bodyBattery) ??
        asNumber(bodyBattery?.endOfDayValue);
      target.bodyBatteryCharged = asNumber(bodyBattery?.chargedValue);
      target.bodyBatteryDrained = asNumber(bodyBattery?.drainedValue);
      target.bodyBatteryMin = asNumber(bodyBattery?.minValue);
      target.bodyBatteryMax = asNumber(bodyBattery?.maxValue);
    }
  } catch {
    // capability may be unavailable
  }

  try {
    const bbReports = await adapter.getBodyBattery(startDate, endDate);
    const rows = extractRows(bbReports, ["bodyBatteryReports"]);
    const list = rows.length ? rows : Array.isArray(bbReports) ? bbReports : [];
    for (const row of list) {
      const r = asRecord(row);
      if (!r) continue;
      const date = asString(r.date) ?? asString(r.calendarDate);
      if (!date) continue;
      const target = ensure(date);
      target.bodyBatteryCharged =
        asNumber(r.charged) ?? (target.bodyBatteryCharged as number | undefined);
      target.bodyBatteryDrained =
        asNumber(r.drained) ?? (target.bodyBatteryDrained as number | undefined);
      const series = parseBodyBatterySeries(r);
      if (series.length) {
        target.bodyBatterySeries = series;
        const last = series[series.length - 1];
        if (target.bodyBattery == null) target.bodyBattery = last.v;
      }
    }
  } catch {
    // optional
  }

  try {
    const stress = await adapter.getDailyStress(startDate, endDate);
    const rows = extractRows(stress, []);
    const list = rows.length ? rows : Array.isArray(stress) ? stress : [];
    for (const row of list) {
      const r = asRecord(row);
      if (!r) continue;
      const date = asString(r.calendarDate) ?? asString(r.date);
      if (!date) continue;
      const values = asRecord(r.values) ?? r;
      const target = ensure(date);
      target.stressLevel =
        asNumber(values.overallStressLevel) ??
        asNumber(values.avgLevel) ??
        (target.stressLevel as number | undefined);
    }
  } catch {
    // optional
  }

  try {
    const sleep = await adapter.getSleepSummaries(startDate, endDate);
    const rows = extractRows(sleep, [
      "dailySleepDtoList",
      "dailySleepList",
      "sleepList",
    ]);
    for (const row of rows) {
      const r = asRecord(row);
      if (!r) continue;
      const date = asString(r.calendarDate) ?? asString(r.sleepDate);
      if (!date) continue;
      // Skip empty placeholder rows (Garmin sometimes returns null calendarDate objects).
      if (
        asNumber(r.sleepTimeSeconds) == null &&
        asNumber(r.sleepDurationInSeconds) == null &&
        !asString(r.sleepStartTimestampGMT)
      ) {
        continue;
      }
      const target = ensure(date);
      target.sleepDurationSeconds =
        asNumber(r.sleepTimeSeconds) ?? asNumber(r.sleepDurationInSeconds);
      target.sleepScore =
        asNumber(asRecord(r.sleepScores)?.overall) ??
        asNumber(r.overallScore) ??
        asNumber(r.sleepScore);
      const startGmt = asString(r.sleepStartTimestampGMT);
      const endGmt = asString(r.sleepEndTimestampGMT);
      if (startGmt) target.sleepStartAt = new Date(startGmt);
      if (endGmt) target.sleepEndAt = new Date(endGmt);
    }
  } catch {
    // optional
  }

  try {
    const hrv = await adapter.getHrvSummaries(startDate, endDate);
    const rows = extractRows(hrv, ["hrvSummaries", "hrvList", "entries"]);
    for (const row of rows) {
      const r = asRecord(row);
      if (!r) continue;
      const date = asString(r.calendarDate) ?? asString(r.date);
      if (!date) continue;
      const target = ensure(date);
      target.hrvMs =
        asNumber(r.lastNightAvg) ??
        asNumber(r.weeklyAvg) ??
        asNumber(r.hrvValue);
    }
  } catch {
    // optional
  }

  try {
    const vo2 = await adapter.getVo2Max(startDate, endDate);
    const root = asRecord(vo2);
    const generic = root?.generic;
    const rows = [
      ...extractRows(vo2, ["maxMetDataDTOList", "entries"]),
      ...(Array.isArray(generic) ? generic : []),
      ...(Array.isArray(vo2)
        ? (vo2 as unknown[]).flatMap((item) => {
            const rec = asRecord(item);
            return rec?.generic ? [rec.generic] : [item];
          })
        : []),
    ];
    for (const row of rows) {
      const r = asRecord(row);
      if (!r) continue;
      const date = asString(r.calendarDate) ?? asString(r.date);
      if (!date) continue;
      const target = ensure(date);
      target.vo2Max =
        asNumber(r.vo2MaxValue) ??
        asNumber(r.vo2MaxPreciseValue) ??
        asNumber(r.vo2Max) ??
        asNumber(asRecord(r.fitnessValue)?.value);
    }
  } catch {
    // optional
  }

  for (const [, payload] of byDate) {
    const date = String(payload.date);
    await DailyMetrics.findOneAndUpdate(
      { date },
      { $set: payload },
      { upsert: true, new: true }
    );
    upserted += 1;
  }

  return { upserted, days: byDate.size, startDate, endDate };
}
