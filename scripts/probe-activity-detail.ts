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
  if (!a) throw new Error("activity missing");

  const { adapter, conn } = await createAuthenticatedAdapter();
  const id = String(a.garminActivityId);
  console.log("garminActivityId", id, "lapCount", a.rawPayload?.lapCount);

  const detail = await adapter.getActivityDetail(id);
  console.log("normalized laps", detail.laps.length, detail.laps.slice(0, 3));
  console.log("samples", detail.samples.length);

  for (const path of [
    `/activity-service/activity/${id}`,
    `/activity-service/activity/${id}/splits`,
    `/activity-service/activity/${id}/details`,
    `/activity-service/activity/${id}/polyLineDTO`,
  ]) {
    try {
      const payload = await adapter.get(path);
      if (payload == null) {
        console.log(path, "null");
        continue;
      }
      if (Array.isArray(payload)) {
        console.log(path, "array", payload.length);
        console.log(" sample", JSON.stringify(payload[0]).slice(0, 400));
        continue;
      }
      const keys = Object.keys(payload as object);
      console.log(path, "keys", keys.slice(0, 40));
      const rec = payload as Record<string, unknown>;
      for (const k of ["laps", "splits", "samples", "activityDetailMetrics", "geoPolylineDTO", "chartDTOs", "details"]) {
        const v = rec[k];
        if (v == null) continue;
        if (Array.isArray(v)) console.log(" ", k, "array", v.length, JSON.stringify(v[0] ?? null).slice(0, 250));
        else if (typeof v === "object") console.log(" ", k, "keys", Object.keys(v as object).slice(0, 20));
      }
      console.log(" head", JSON.stringify(payload).slice(0, 600));
    } catch (e) {
      console.log(path, "ERR", e instanceof Error ? e.message : e);
    }
    console.log("---");
  }

  await persistAdapterToken(conn._id, adapter);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
