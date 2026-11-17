import { connectMongo } from "@/lib/database/mongoose";
import { Activity, UserAchievement } from "@/models";

type AchievementDef = {
  id: string;
  title: string;
  description: string;
  test: (ctx: {
    distanceMeters: number;
    totalMeters: number;
    runIndex: number;
    uniqueDays: number;
  }) => boolean;
};

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_run",
    title: "First stride",
    description: "Logged your first running activity.",
    test: ({ runIndex }) => runIndex === 0,
  },
  {
    id: "first_5k",
    title: "First 5K",
    description: "Completed a run of at least 5 km.",
    test: ({ distanceMeters }) => distanceMeters >= 5000,
  },
  {
    id: "first_10k",
    title: "First 10K",
    description: "Completed a run of at least 10 km.",
    test: ({ distanceMeters }) => distanceMeters >= 10000,
  },
  {
    id: "distance_50k",
    title: "50 km club",
    description: "Reached 50 km total running distance.",
    test: ({ totalMeters }) => totalMeters >= 50000,
  },
  {
    id: "distance_100k",
    title: "100 km club",
    description: "Reached 100 km total running distance.",
    test: ({ totalMeters }) => totalMeters >= 100000,
  },
  {
    id: "consistent_week",
    title: "Three run days",
    description: "Ran on at least three different calendar days.",
    test: ({ uniqueDays }) => uniqueDays >= 3,
  },
];

export async function evaluateAchievements() {
  await connectMongo();
  const runs = await Activity.find({ activityType: "running" })
    .sort({ startedAt: 1 })
    .lean();

  let total = 0;
  const daySet = new Set<string>();
  const unlocked = [];

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    total += run.distanceMeters ?? 0;
    daySet.add(new Date(run.startedAt).toISOString().slice(0, 10));
    for (const def of ACHIEVEMENTS) {
      const existing = await UserAchievement.findOne({
        achievementId: def.id,
      }).lean();
      if (existing) continue;
      if (
        def.test({
          distanceMeters: run.distanceMeters ?? 0,
          totalMeters: total,
          runIndex: i,
          uniqueDays: daySet.size,
        })
      ) {
        const created = await UserAchievement.create({
          achievementId: def.id,
          title: def.title,
          description: def.description,
          unlockedAt: run.startedAt,
          sourceActivityId: run._id,
          evidence: {
            distanceMeters: run.distanceMeters,
            totalDistanceMeters: total,
            uniqueDays: daySet.size,
          },
        });
        unlocked.push(created.toObject());
      }
    }
  }

  return unlocked;
}

export async function getJourneyOverview() {
  await connectMongo();
  const runs = await Activity.find({ activityType: "running" })
    .sort({ startedAt: -1 })
    .lean();

  const daySet = new Set(
    runs.map((r) => new Date(r.startedAt).toISOString().slice(0, 10))
  );
  const dates = [...daySet].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let cursor = new Date(`${today}T00:00:00.000Z`);

  // Streak: consecutive calendar days with a qualifying run, allowing today or yesterday as start.
  if (dates[0] === today || dates[0] === new Date(Date.now() - 86400000).toISOString().slice(0, 10)) {
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
  }

  const heatmap = [...daySet].map((date) => ({
    date,
    count: runs.filter(
      (r) => new Date(r.startedAt).toISOString().slice(0, 10) === date
    ).length,
  }));

  const achievements = await UserAchievement.find()
    .sort({ unlockedAt: -1 })
    .lean();

  const longest = runs.reduce<(typeof runs)[number] | null>((best, run) => {
    if (!best || (run.distanceMeters ?? 0) > (best.distanceMeters ?? 0)) return run;
    return best;
  }, null);

  return {
    streakDays: streak,
    streakDefinition:
      "Consecutive calendar days with at least one running activity (UTC date keys).",
    totalRuns: runs.length,
    totalDistanceMeters: runs.reduce(
      (sum, r) => sum + (r.distanceMeters ?? 0),
      0
    ),
    longestRun: longest
      ? {
          id: String(longest._id),
          startedAt: longest.startedAt,
          distanceMeters: longest.distanceMeters,
          activityName: longest.activityName,
        }
      : null,
    heatmap,
    achievements,
  };
}
