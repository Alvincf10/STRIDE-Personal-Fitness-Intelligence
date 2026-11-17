import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getBaselineHistory } from "@/modules/personal-intelligence/baseline-history";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "20");
  return ok(await getBaselineHistory(metric, limit));
}
