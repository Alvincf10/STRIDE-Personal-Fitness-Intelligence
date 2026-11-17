import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getEnergyTimeline } from "@/modules/energy-timeline/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  return ok(await getEnergyTimeline({ date }));
}
