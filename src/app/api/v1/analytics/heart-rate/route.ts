import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getHeartRateTrends } from "@/modules/analytics/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to")
    ? new Date(`${searchParams.get("to")}T23:59:59.999Z`)
    : new Date();
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(to.getTime() - 28 * 24 * 60 * 60 * 1000);
  return ok(await getHeartRateTrends(from, to));
}
