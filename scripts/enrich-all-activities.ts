import { getActivityById } from "../src/modules/activities/service";
import { connectMongo } from "../src/lib/database/mongoose";
import { Activity } from "../src/models";
import { syncHealthMetrics } from "../src/modules/fitness-core/health-sync";
import {
  createAuthenticatedAdapter,
  persistAdapterToken,
} from "../src/modules/garmin/connection-service";
import { downloadFitForActivity } from "../src/modules/fit/service";

async function main() {
  await connectMongo();
  const { adapter, conn } = await createAuthenticatedAdapter();
  console.log("health sync…");
  const health = await syncHealthMetrics(adapter);
  console.log("health", health);
  await persistAdapterToken(conn._id, adapter);

  const activities = await Activity.find().sort({ startedAt: -1 }).lean();
  for (const a of activities) {
    const id = String(a._id);
    console.log("enrich", a.activityName, id);
    const result = await getActivityById(id);
    console.log(
      " ",
      "samples",
      result?.detail?.samples?.length ?? 0,
      "route",
      result?.detail?.routePoints?.length ?? 0,
      "laps",
      result?.detail?.laps?.length ?? 0
    );
    if (a.activityType === "running" && (result?.detail?.samples?.length ?? 0) > 50) {
      const fit = await downloadFitForActivity(id);
      console.log("  fit", fit?.status, fit?.byteSize);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
