import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getAerobicEfficiency } from "@/modules/aerobic-efficiency/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "28");
  const compareDays = Number(searchParams.get("compareDays") ?? String(days));
  return ok(
    await getAerobicEfficiency({
      days: Number.isFinite(days) ? days : 28,
      compareDays: Number.isFinite(compareDays) ? compareDays : 28,
    })
  );
}
