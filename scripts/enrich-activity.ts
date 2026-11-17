import { getActivityById } from "../src/modules/activities/service";

async function main() {
  const id = process.argv[2] ?? "6afc104764f4cb32916c3eef";
  const result = await getActivityById(id);
  if (!result) {
    console.log("not found");
    process.exit(1);
  }
  console.log("name", result.activity.activityName);
  console.log("samples", result.detail?.samples?.length ?? 0);
  console.log("route", result.detail?.routePoints?.length ?? 0, result.detail?.routeSource);
  console.log("laps", result.detail?.laps?.length ?? 0);
  console.log("evaluation zones", result.evaluation?.zones?.percents);
  console.log("sample status", result.evaluation?.sampleStatus);
  const first = result.detail?.samples?.[0];
  const mid = result.detail?.samples?.[Math.floor((result.detail?.samples?.length ?? 0) / 2)];
  console.log("sample first", first);
  console.log("sample mid", mid);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
