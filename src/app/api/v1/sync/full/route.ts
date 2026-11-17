import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { queueSyncJob } from "@/modules/synchronization/service";

export async function POST() {
  const { error } = await requireApiSession();
  if (error) return error;
  const [activities, health] = await Promise.all([
    queueSyncJob("activities"),
    queueSyncJob("health"),
  ]);
  return ok({ activities, health }, { status: 202 });
}
