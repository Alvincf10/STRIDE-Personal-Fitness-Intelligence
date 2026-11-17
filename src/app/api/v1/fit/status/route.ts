import { requireApiSession } from "@/lib/auth/guard";
import { ok } from "@/lib/utils/api-response";
import { getFitStatus } from "@/modules/fit/service";

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const garminActivityId = searchParams.get("garminActivityId") ?? undefined;
  return ok(await getFitStatus(garminActivityId ?? undefined));
}
