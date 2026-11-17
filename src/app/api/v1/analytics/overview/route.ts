import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getOverview } from "@/modules/analytics/service";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 28);
  return { from, to };
}

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const range = defaultRange();
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : range.from;
  const to = searchParams.get("to")
    ? new Date(`${searchParams.get("to")}T23:59:59.999Z`)
    : range.to;
  return ok(await getOverview(from, to));
}
