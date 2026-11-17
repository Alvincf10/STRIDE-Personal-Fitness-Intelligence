import { requireApiSession } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/utils/api-response";
import { GarminAdapterError } from "@/modules/garmin/adapter";
import { testGarminConnection } from "@/modules/garmin/connection-service";

export async function POST() {
  const { error } = await requireApiSession();
  if (error) return error;

  try {
    return ok(await testGarminConnection());
  } catch (err) {
    if (err instanceof GarminAdapterError) {
      return fail(err.code, err.message, 400);
    }
    return fail(
      "GARMIN_TEST_FAILED",
      err instanceof Error ? err.message : "Connection test failed.",
      400
    );
  }
}
