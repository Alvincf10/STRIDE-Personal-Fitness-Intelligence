import {
  createAuthenticatedAdapter,
  persistAdapterToken,
} from "../src/modules/garmin/connection-service";

async function main() {
  const { adapter, conn } = await createAuthenticatedAdapter();
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const sum = (await adapter.getDailySummaries(start, end)) as {
    data?: Array<Record<string, unknown>>;
  };
  const row = sum.data?.[sum.data.length - 2] ?? sum.data?.[0];
  console.log("stress", JSON.stringify(row?.stress));
  console.log("bodyBattery", JSON.stringify(row?.bodyBattery));
  console.log("movement", JSON.stringify(row?.movement));
  console.log("heartRate", JSON.stringify(row?.heartRate));

  const bb = await adapter.getBodyBattery(start, end);
  console.log("bb report head", JSON.stringify(bb).slice(0, 500));

  for (const path of [
    "/download-service/files/activity/25043636099",
    "/activity-service/activity/25043636099/file",
  ]) {
    try {
      const token = (await adapter.obtainToken()).accessToken;
      const res = await fetch(`https://personal.connectapi.garmin.com${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
      });
      const text = await res.text();
      console.log("FIT", path, res.status, res.headers.get("content-type"), text.slice(0, 120));
    } catch (e) {
      console.log("FIT", path, e instanceof Error ? e.message : e);
    }
  }

  // multi-sport list without running filter
  const params = new URLSearchParams({
    start: "0",
    limit: "20",
    startDate: start,
    endDate: end,
    sortBy: "startLocal",
    sortOrder: "desc",
  });
  const multi = await adapter.get(
    `/activitylist-service/activities/search/activities?${params}`
  );
  const rows = Array.isArray(multi) ? multi : [];
  console.log(
    "multi activities",
    rows.length,
    rows.slice(0, 8).map((r) => {
      const o = r as Record<string, unknown>;
      const t = o.activityType as Record<string, unknown> | undefined;
      return { name: o.activityName, type: t?.typeKey, id: o.activityId };
    })
  );

  await persistAdapterToken(conn._id, adapter);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
