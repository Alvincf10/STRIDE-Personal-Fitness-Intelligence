import { z } from "zod";
import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import {
  getOrCreateHrZones,
  replaceHrZones,
} from "@/modules/settings/service";

const schema = z.object({
  method: z.enum(["custom", "max_hr", "heart_rate_reserve"]),
  maxHeartRateBpm: z.number().int().positive().optional(),
  restingHeartRateBpm: z.number().int().positive().optional(),
  zones: z
    .array(
      z.object({
        zone: z.number().int().min(1).max(5),
        minBpm: z.number().int().positive(),
        maxBpm: z.number().int().positive(),
        label: z.string().min(1),
      })
    )
    .min(1),
});

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getOrCreateHrZones());
}

export async function PUT(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid HR zone configuration.");
  }
  try {
    return ok(await replaceHrZones(parsed.data));
  } catch (err) {
    return fail(
      "INVALID_ZONES",
      err instanceof Error ? err.message : "Invalid zone boundaries.",
      400
    );
  }
}
