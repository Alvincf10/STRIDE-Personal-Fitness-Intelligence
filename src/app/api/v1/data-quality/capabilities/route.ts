import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getCapabilityMatrix } from "@/modules/data-quality/capabilities";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getCapabilityMatrix());
}
