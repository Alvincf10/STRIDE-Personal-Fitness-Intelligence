import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { getActivityById } from "@/modules/activities/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { id } = await context.params;
  const result = await getActivityById(id);
  if (!result) return fail("NOT_FOUND", "Activity not found.", 404);
  return ok(result);
}
