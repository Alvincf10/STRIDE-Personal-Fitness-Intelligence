import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getTrainingCalendar } from "@/modules/running-coach/calendar";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "14");
  return ok(await getTrainingCalendar(Number.isFinite(days) ? days : 14));
}
