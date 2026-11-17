import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { getActivitySummary } from "@/modules/activities/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return fail("VALIDATION_ERROR", "from and to query params are required.");
  }

  return ok(
    await getActivitySummary(
      new Date(from),
      new Date(`${to}T23:59:59.999Z`),
      searchParams.get("type") ?? "running"
    )
  );
}
