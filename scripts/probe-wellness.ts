import { createAuthenticatedAdapter, persistAdapterToken } from "../src/modules/garmin/connection-service";

function summarize(label: string, payload: unknown) {
  if (payload == null) {
    console.log(label, "null");
    return;
  }
  if (Array.isArray(payload)) {
    console.log(label, "array len", payload.length);
    if (payload[0]) {
      console.log(label, "first keys", Object.keys(payload[0] as object).slice(0, 40));
      console.log(label, "first sample", JSON.stringify(payload[0]).slice(0, 700));
    }
    return;
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    console.log(label, "object keys", Object.keys(o).slice(0, 50));
    for (const [k, v] of Object.entries(o).slice(0, 12)) {
      if (Array.isArray(v)) {
        console.log(
          " ",
          k,
          "array",
          v.length,
          v[0] ? "firstKeys=" + Object.keys(v[0] as object).slice(0, 25).join(",") : ""
        );
        if (v[0]) console.log("   sample", JSON.stringify(v[0]).slice(0, 500));
      } else if (v && typeof v === "object") {
        console.log(" ", k, "object keys", Object.keys(v as object).slice(0, 25).join(","));
      } else {
        console.log(" ", k, typeof v, String(v).slice(0, 100));
      }
    }
    console.log(label, "json head", JSON.stringify(payload).slice(0, 800));
  }
}

async function main() {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  console.log("range", start, end);
  const { adapter, conn } = await createAuthenticatedAdapter();
  const endpoints: Array<[string, () => Promise<unknown>]> = [
    ["dailysummaries", () => adapter.getDailySummaries(start, end)],
    ["sleep", () => adapter.getSleepSummaries(start, end)],
    ["hrv", () => adapter.getHrvSummaries(start, end)],
    ["vo2", () => adapter.getVo2Max(start, end)],
    ["bodyBattery", () => adapter.getBodyBattery(start, end)],
    ["stress", () => adapter.getDailyStress(start, end)],
  ];
  for (const [name, fn] of endpoints) {
    try {
      const p = await fn();
      summarize(name, p);
    } catch (e) {
      console.log(name, "ERROR", e instanceof Error ? `${(e as { code?: string }).code ?? ""} ${e.message}` : e);
    }
    console.log("---");
  }
  await persistAdapterToken(conn._id, adapter);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
