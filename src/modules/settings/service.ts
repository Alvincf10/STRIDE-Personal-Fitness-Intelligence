import { connectMongo } from "@/lib/database/mongoose";
import { HrZoneSettings, UserSettings } from "@/models";

const DEFAULT_ZONES = [
  { zone: 1, minBpm: 90, maxBpm: 113, label: "Zone 1" },
  { zone: 2, minBpm: 114, maxBpm: 132, label: "Zone 2" },
  { zone: 3, minBpm: 133, maxBpm: 151, label: "Zone 3" },
  { zone: 4, minBpm: 152, maxBpm: 170, label: "Zone 4" },
  { zone: 5, minBpm: 171, maxBpm: 200, label: "Zone 5" },
];

export async function getOrCreateSettings() {
  await connectMongo();
  let settings = await UserSettings.findOne().lean();
  if (!settings) {
    const created = await UserSettings.create({});
    settings = created.toObject();
  }
  return settings;
}

export async function updateSettings(
  patch: Partial<{
    timezone: string;
    distanceUnit: "km" | "mi";
    paceUnit: "min/km" | "min/mi";
    weeklyDistanceGoalKm: number | null;
  }>
) {
  await connectMongo();
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};

  if (patch.timezone != null) $set.timezone = patch.timezone;
  if (patch.distanceUnit != null) $set.distanceUnit = patch.distanceUnit;
  if (patch.paceUnit != null) $set.paceUnit = patch.paceUnit;
  if (patch.weeklyDistanceGoalKm === null) {
    $unset.weeklyDistanceGoalKm = 1;
  } else if (patch.weeklyDistanceGoalKm != null) {
    $set.weeklyDistanceGoalKm = patch.weeklyDistanceGoalKm;
  }

  const update: Record<string, unknown> = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;

  const settings = await UserSettings.findOneAndUpdate({}, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).lean();
  return settings;
}

export function validateZones(
  zones: Array<{ zone: number; minBpm: number; maxBpm: number; label: string }>
): string | null {
  if (zones.length === 0) return "At least one zone is required";
  const ordered = [...zones].sort((a, b) => a.zone - b.zone);
  for (let i = 0; i < ordered.length; i++) {
    const z = ordered[i];
    if (z.minBpm >= z.maxBpm) {
      return `Zone ${z.zone} boundaries must be ordered`;
    }
    if (i > 0 && z.minBpm <= ordered[i - 1].maxBpm) {
      return "Zones must be non-overlapping";
    }
  }
  return null;
}

export async function getOrCreateHrZones() {
  await connectMongo();
  let zones = await HrZoneSettings.findOne().lean();
  if (!zones) {
    const created = await HrZoneSettings.create({
      method: "custom",
      zones: DEFAULT_ZONES,
    });
    zones = created.toObject();
  }
  return zones;
}

export async function replaceHrZones(input: {
  method: "custom" | "max_hr" | "heart_rate_reserve";
  maxHeartRateBpm?: number;
  restingHeartRateBpm?: number;
  zones: Array<{ zone: number; minBpm: number; maxBpm: number; label: string }>;
}) {
  const error = validateZones(input.zones);
  if (error) throw new Error(error);

  await connectMongo();
  return HrZoneSettings.findOneAndUpdate({}, input, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).lean();
}
