import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getRunningDna } from "@/modules/personal-intelligence/baselines";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getRunningDna());
}
