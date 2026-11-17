import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getRecoveryOverview } from "@/modules/recovery/service";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getRecoveryOverview());
}
