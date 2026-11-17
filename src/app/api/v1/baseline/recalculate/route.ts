import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { recalculateBaselines } from "@/modules/personal-intelligence/baselines";

export async function POST() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await recalculateBaselines(), { status: 202 });
}
