import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getTrainingLoad } from "@/modules/training-load/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "42");
  return ok(
    await getTrainingLoad({
      days: Number.isFinite(days) ? days : 42,
    })
  );
}
