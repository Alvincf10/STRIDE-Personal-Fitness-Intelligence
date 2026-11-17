import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { compareActivities } from "@/modules/activities/compare";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const a = searchParams.get("a");
  const b = searchParams.get("b");
  if (!a || !b) return fail("VALIDATION_ERROR", "Query a and b are required.");
  try {
    return ok(await compareActivities(a, b));
  } catch (err) {
    return fail(
      "COMPARE_FAILED",
      err instanceof Error ? err.message : "Compare failed.",
      400
    );
  }
}
