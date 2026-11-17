import { connectMongo } from "@/lib/database/mongoose";
import { FeatureCapability } from "@/models";
import type { GarminAdapter } from "@/modules/garmin/adapter";

const PROBES: Array<{
  endpointKey: string;
  label: string;
  path: string;
  params?: Record<string, string>;
}> = [
  {
    endpointKey: "activities.search",
    label: "Activity search",
    path: "/activitylist-service/activities/search/activities",
    params: { start: "0", limit: "1" },
  },
  {
    endpointKey: "userprofile.settings",
    label: "User profile settings",
    path: "/userprofile-service/userprofile/settings",
  },
  {
    endpointKey: "daily.summaries",
    label: "Daily summaries",
    path: "/usersummary-service/v2/dailysummaries",
    params: {
      startDate: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    },
  },
  {
    endpointKey: "sleep.summaries",
    label: "Sleep summaries",
    path: "/sleep-service/sleep/dailySleepSummariesByDate",
    params: {
      startDate: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    },
  },
  {
    endpointKey: "hrv.daily",
    label: "HRV daily",
    path: `/hrv-service/hrv/daily/${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)}/${new Date().toISOString().slice(0, 10)}`,
  },
  {
    endpointKey: "vo2max.daily",
    label: "VO2 Max daily",
    path: `/metrics-service/metrics/maxmet/daily/${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}/${new Date().toISOString().slice(0, 10)}`,
  },
];

function sampleFields(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object"
      ? Object.keys(first as object).slice(0, 20)
      : [];
  }
  return Object.keys(payload as object).slice(0, 20);
}

export async function probeCapabilities(adapter: GarminAdapter) {
  await connectMongo();
  const now = new Date();
  const results = [];

  for (const probe of PROBES) {
    try {
      const payload = await adapter.get(probe.path, probe.params);
      const fields = sampleFields(payload);
      const doc = await FeatureCapability.findOneAndUpdate(
        { provider: "garmin", endpointKey: probe.endpointKey },
        {
          label: probe.label,
          status: "available",
          lastCheckedAt: now,
          lastSuccessAt: now,
          sampleFields: fields,
          sanitizedNote: "Probe succeeded",
        },
        { upsert: true, new: true }
      ).lean();
      results.push(doc);
    } catch (error) {
      const doc = await FeatureCapability.findOneAndUpdate(
        { provider: "garmin", endpointKey: probe.endpointKey },
        {
          label: probe.label,
          status: "unavailable",
          lastCheckedAt: now,
          sampleFields: [],
          sanitizedNote:
            error instanceof Error ? error.message : "Probe failed",
        },
        { upsert: true, new: true }
      ).lean();
      results.push(doc);
    }
  }

  return results;
}

export async function listCapabilities() {
  await connectMongo();
  return FeatureCapability.find({ provider: "garmin" })
    .sort({ endpointKey: 1 })
    .lean();
}
