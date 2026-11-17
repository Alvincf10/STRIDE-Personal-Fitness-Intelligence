import { z } from "zod";
import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import {
  parseAllStoredFits,
  parseStoredFit,
} from "@/modules/fit/service";

const bodySchema = z.object({
  garminActivityId: z.string().min(1).optional(),
  all: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid FIT parse body.");
  }
  try {
    if (parsed.data.all) {
      return ok(await parseAllStoredFits(parsed.data.limit ?? 50));
    }
    if (!parsed.data.garminActivityId) {
      return fail(
        "VALIDATION_ERROR",
        "garminActivityId is required unless all=true."
      );
    }
    return ok(await parseStoredFit(parsed.data.garminActivityId));
  } catch (err) {
    return fail(
      "FIT_PARSE_FAILED",
      err instanceof Error ? err.message : "FIT parse failed.",
      400
    );
  }
}
