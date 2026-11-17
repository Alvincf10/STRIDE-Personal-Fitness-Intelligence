import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getHrZoneIntelligence } from "@/modules/hr-zones/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "28");
  const activityId = searchParams.get("activityId") ?? undefined;
  return ok(
    await getHrZoneIntelligence({
      days: Number.isFinite(days) ? days : 28,
      activityId,
    })
  );
}
