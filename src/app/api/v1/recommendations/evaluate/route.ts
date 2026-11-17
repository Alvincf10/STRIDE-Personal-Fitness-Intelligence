import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { evaluateRecommendations } from "@/modules/recommendations/service";

export async function POST() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await evaluateRecommendations(), { status: 202 });
}
