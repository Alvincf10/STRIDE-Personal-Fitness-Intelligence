import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { dismissRecommendation } from "@/modules/recommendations/service";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { id } = await context.params;
  const updated = await dismissRecommendation(id);
  if (!updated) return fail("NOT_FOUND", "Recommendation not found.", 404);
  return ok(updated);
}
