import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { queueSyncJob } from "@/modules/synchronization/service";

export async function POST() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await queueSyncJob("health"), { status: 202 });
}
