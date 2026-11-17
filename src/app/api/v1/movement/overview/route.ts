import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getDailyMovement } from "@/modules/daily-movement/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "28");
  return ok(
    await getDailyMovement({ days: Number.isFinite(days) ? days : 28 })
  );
}
