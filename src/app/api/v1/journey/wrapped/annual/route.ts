import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getAnnualWrapped } from "@/modules/journey/wrapped";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;
  return ok(
    await getAnnualWrapped(
      year != null && Number.isFinite(year) ? year : undefined
    )
  );
}
