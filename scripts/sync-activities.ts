import { connectMongo } from "../src/lib/database/mongoose";
import { getMultiSportOverview } from "../src/modules/multi-sport/service";
import { runSyncBlocking } from "../src/modules/synchronization/service";

async function main() {
  await connectMongo();
  console.log("syncing activities (all types)…");
  const job = await runSyncBlocking("activities");
  console.log(JSON.stringify(job, null, 2));
  const overview = await getMultiSportOverview({ days: 90 });
  console.log(
    JSON.stringify(
      {
        status: overview.status,
        sports: overview.sports.slice(0, 8),
        recentTypes: overview.recent.slice(0, 8).map((r) => r.activityType),
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
