import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getDataQualityOverview } from "@/modules/data-quality/overview";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getDataQualityOverview());
}
