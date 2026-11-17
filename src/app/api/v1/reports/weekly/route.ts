import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getWeeklyReport } from "@/modules/reports/weekly";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getWeeklyReport());
}
