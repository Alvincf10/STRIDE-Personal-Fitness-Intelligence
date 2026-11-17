import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getOverview } from "@/modules/analytics/service";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 30);
  return ok(await getOverview(from, to));
}
