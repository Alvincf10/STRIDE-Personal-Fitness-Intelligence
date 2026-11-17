import { z } from "zod";
import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { downloadFitForActivity } from "@/modules/fit/service";

const bodySchema = z.object({
  activityId: z.string().min(1),
});

export async function POST(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "activityId is required.");
  }
  try {
    return ok(await downloadFitForActivity(parsed.data.activityId));
  } catch (err) {
    return fail(
      "FIT_DOWNLOAD_FAILED",
      err instanceof Error ? err.message : "FIT download failed.",
      400
    );
  }
}
