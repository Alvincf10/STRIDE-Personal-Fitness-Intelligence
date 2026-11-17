import { z } from "zod";
import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { createGoal, listGoals } from "@/modules/race-goals/service";

const createSchema = z.object({
  type: z.enum(["1k", "5k", "10k", "half_marathon", "marathon", "custom"]),
  title: z.string().min(1),
  targetDistanceMeters: z.number().positive().optional(),
  targetTimeSeconds: z.number().positive().optional(),
  targetDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  return ok(await listGoals());
}

export async function POST(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Invalid goal payload.");
  }
  const created = await createGoal(parsed.data);
  return ok(created.toObject(), { status: 201 });
}
