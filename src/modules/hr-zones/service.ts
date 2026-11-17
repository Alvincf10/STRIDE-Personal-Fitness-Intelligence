import { connectMongo } from "@/lib/database/mongoose";
import { Activity } from "@/models";
import { getOrCreateHrZones } from "@/modules/settings/service";

export type ZoneSeconds = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

function emptyZones(): ZoneSeconds {
  return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function extractGarminZoneSeconds(
  rawPayload: Record<string, unknown> | null | undefined
): ZoneSeconds | null {
  if (!rawPayload) return null;
  const zones = emptyZones();
  let any = false;
  for (let i = 1; i <= 5; i++) {
    const key = `hrTimeInZone_${i}` as const;
    const seconds = asNumber(rawPayload[key]);
    if (seconds != null && seconds > 0) {
      any = true;
      zones[`z${i}` as keyof ZoneSeconds] = seconds;
    } else if (seconds === 0) {
      // Explicit zero still counts as Garmin providing the field.
      any = true;
    }
  }
  // Also accept if all zeros but fields exist (device reported zeros).
  if (!any) {
    const hasFields = [1, 2, 3, 4, 5].some(
      (i) => asNumber(rawPayload[`hrTimeInZone_${i}`]) != null
    );
    if (!hasFields) return null;
  }
  return zones;
}

function addZones(a: ZoneSeconds, b: ZoneSeconds): ZoneSeconds {
  return {
    z1: a.z1 + b.z1,
    z2: a.z2 + b.z2,
    z3: a.z3 + b.z3,
    z4: a.z4 + b.z4,
    z5: a.z5 + b.z5,
  };
}

function toPercents(zones: ZoneSeconds) {
  const total = zones.z1 + zones.z2 + zones.z3 + zones.z4 + zones.z5;
  if (total <= 0) {
    return {
      totalSeconds: 0,
      percents: { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 },
    };
  }
  const pct = (n: number) => Number(((n / total) * 100).toFixed(1));
  return {
    totalSeconds: Number(total.toFixed(1)),
    percents: {
      z1: pct(zones.z1),
      z2: pct(zones.z2),
      z3: pct(zones.z3),
      z4: pct(zones.z4),
      z5: pct(zones.z5),
    },
  };
}

function periodStart(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getHrZoneIntelligence(params?: {
  days?: number;
  activityId?: string;
}) {
  await connectMongo();
  const days = Math.min(90, Math.max(7, params?.days ?? 28));
  const zoneSettings = await getOrCreateHrZones();
  const from = periodStart(days);

  const filter: Record<string, unknown> = { activityType: "running" };
  if (params?.activityId) {
    filter._id = params.activityId;
  } else {
    filter.startedAt = { $gte: from };
  }

  const activities = await Activity.find(filter).sort({ startedAt: -1 }).lean();

  let aggregate = emptyZones();
  let eligible = 0;
  let ineligible = 0;
  const perActivity: Array<{
    id: string;
    activityName?: string;
    startedAt: string;
    source: "garmin_summary";
    zones: ZoneSeconds;
    totalSeconds: number;
    zone2Pct: number;
  }> = [];

  for (const activity of activities) {
    const raw = asRecord(activity.rawPayload);
    const zones = extractGarminZoneSeconds(raw);
    if (!zones) {
      ineligible += 1;
      continue;
    }
    const { totalSeconds, percents } = toPercents(zones);
    if (totalSeconds <= 0) {
      ineligible += 1;
      continue;
    }
    eligible += 1;
    aggregate = addZones(aggregate, zones);
    perActivity.push({
      id: String(activity._id),
      activityName: activity.activityName,
      startedAt: new Date(activity.startedAt).toISOString(),
      source: "garmin_summary",
      zones,
      totalSeconds,
      zone2Pct: percents.z2,
    });
  }

  const rolled = toPercents(aggregate);
  const available = eligible > 0;

  return {
    available,
    status: available ? ("ready" as const) : ("insufficient_data" as const),
    calculationVersion: "1.0.0",
    method: "garmin_hrTimeInZone_summary",
    sourceLabel: "Garmin-provided time-in-zone summaries from activity payloads",
    limitations: [
      "Uses Garmin hrTimeInZone_* fields, not STRIDE-reconstructed samples.",
      "Zone boundaries shown below are your STRIDE settings for reference; Garmin summaries use the watch/account zone definition at capture time.",
      "Activities without hrTimeInZone_* are excluded, not treated as zero.",
    ],
    windowDays: days,
    zoneSettings: {
      method: zoneSettings.method,
      source: "user_settings",
      zones: zoneSettings.zones,
    },
    eligibleActivityCount: eligible,
    ineligibleActivityCount: ineligible,
    distribution: available
      ? {
          seconds: aggregate,
          ...rolled,
        }
      : null,
    zone2: available
      ? {
          seconds: aggregate.z2,
          percent: rolled.percents.z2,
          eligibleActivityCount: eligible,
        }
      : null,
    activities: perActivity.slice(0, 20),
    explanation: available
      ? `${eligible} run(s) include Garmin zone-time summaries in the last ${days} days.`
      : "No Garmin hrTimeInZone_* summaries found on synced runs. Average HR alone cannot invent zone-time.",
    evaluatedAt: new Date().toISOString(),
  };
}
