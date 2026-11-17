import { z } from "zod";
import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { connectGarmin } from "@/modules/garmin/connection-service";

const schema = z.object({
  apiKey: z.string().min(8),
});

export async function POST(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "A valid apiKey is required.");
  }

  try {
    const status = await connectGarmin(parsed.data.apiKey);
    return ok(status);
  } catch (err) {
    return fail(
      "GARMIN_CONNECT_FAILED",
      err instanceof Error ? err.message : "Could not store Garmin credentials.",
      400
    );
  }
}
