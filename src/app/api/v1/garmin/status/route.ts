import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getConnectionStatus } from "@/modules/garmin/connection-service";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getConnectionStatus());
}
