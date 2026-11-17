import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { listActivities } from "@/modules/activities/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");

  return ok(
    await listActivities({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
      type,
      page,
      limit,
    })
  );
}
