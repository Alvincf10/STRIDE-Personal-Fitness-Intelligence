import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { disconnectGarmin } from "@/modules/garmin/connection-service";

export async function DELETE() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await disconnectGarmin());
}
