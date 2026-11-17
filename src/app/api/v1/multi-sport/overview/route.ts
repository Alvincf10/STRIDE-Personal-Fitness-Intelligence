import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getMultiSportOverview } from "@/modules/multi-sport/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "90");
  return ok(
    await getMultiSportOverview({ days: Number.isFinite(days) ? days : 90 })
  );
}
