import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getSyncHealth } from "@/modules/data-quality/sync-health";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getSyncHealth());
}
