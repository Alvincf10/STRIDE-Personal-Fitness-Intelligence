import { z } from "zod";
import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { getOrCreateSettings, updateSettings } from "@/modules/settings/service";

const patchSchema = z.object({
  timezone: z.string().min(1).optional(),
  distanceUnit: z.enum(["km", "mi"]).optional(),
  paceUnit: z.enum(["min/km", "min/mi"]).optional(),
  weeklyDistanceGoalKm: z.number().positive().nullable().optional(),
});

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await getOrCreateSettings());
}

export async function PATCH(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid settings payload.");
  }
  return ok(await updateSettings(parsed.data));
}
