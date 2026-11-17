import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getDataCoverage } from "@/modules/data-quality/coverage";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getDataCoverage());
}
