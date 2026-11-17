import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getGoalProgress } from "@/modules/race-goals/service";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getGoalProgress());
}
