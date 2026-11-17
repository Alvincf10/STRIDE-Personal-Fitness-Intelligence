import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getMonthlyWrapped } from "@/modules/journey/wrapped";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  return ok(await getMonthlyWrapped(searchParams.get("month") ?? undefined));
}
