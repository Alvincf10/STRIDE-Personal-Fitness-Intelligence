import { MongoClient, ObjectId } from "mongodb";
import {
  createAuthenticatedAdapter,
  persistAdapterToken,
} from "../src/modules/garmin/connection-service";

async function main() {
  const mongo = new MongoClient("mongodb://127.0.0.1:27017/garmin_fitness");
  await mongo.connect();
  const a = await mongo
    .db()
    .collection("activities")
    .findOne({ _id: new ObjectId("6afc104764f4cb32916c3eef") });
  await mongo.close();
  if (!a) throw new Error("missing");

  const { adapter, conn } = await createAuthenticatedAdapter();
  const id = String(a.garminActivityId);
  const payload = (await adapter.get(
    `/activity-service/activity/${id}/details`
  )) as Record<string, unknown>;

  const descriptors = (payload.metricDescriptors as Array<Record<string, unknown>>) ?? [];
  console.log(
    "descriptors",
    descriptors.map((d) => `${d.metricsIndex}:${d.key}`).join(" | ")
  );

  const metrics = (payload.activityDetailMetrics as Array<{ metrics: unknown[] }>) ?? [];
  console.log("metric rows", metrics.length);
  console.log("row0", JSON.stringify(metrics[0]));
  console.log("row mid", JSON.stringify(metrics[Math.floor(metrics.length / 2)]));
  console.log("row last", JSON.stringify(metrics[metrics.length - 1]));

  const poly = payload.geoPolylineDTO as Record<string, unknown> | undefined;
  const polyline = poly?.polyline;
  console.log(
    "polyline type",
    typeof polyline,
    Array.isArray(polyline) ? `array ${polyline.length}` : "",
    JSON.stringify(polyline).slice(0, 400)
  );

  const hr = payload.heartRateDTOs;
  console.log("heartRateDTOs", JSON.stringify(hr).slice(0, 400));

  // also splitSummaries from main activity
  const summary = (await adapter.get(
    `/activity-service/activity/${id}`
  )) as Record<string, unknown>;
  console.log("splitSummaries", JSON.stringify(summary.splitSummaries).slice(0, 800));

  await persistAdapterToken(conn._id, adapter);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
