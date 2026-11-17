import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { listCapabilities } from "@/modules/fitness-core/capabilities";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await listCapabilities());
}
