import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getDailySuggestion } from "@/modules/running-coach/daily-suggestion";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getDailySuggestion());
}
