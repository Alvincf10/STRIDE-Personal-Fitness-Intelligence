import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { listRecommendations } from "@/modules/recommendations/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") === "all" ? "all" : "active";
  return ok(await listRecommendations(status));
}
