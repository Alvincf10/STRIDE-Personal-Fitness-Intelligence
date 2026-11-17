import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { listRecommendations } from "@/modules/recommendations/service";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  const items = await listRecommendations("active");
  return ok({ items: items.slice(0, 5) });
}
