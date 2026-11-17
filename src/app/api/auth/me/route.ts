import { getSession } from "@/lib/auth/session";
import { fail, ok } from "@/lib/utils/api-response";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return fail("UNAUTHORIZED", "Access denied.", 401);
  }
  return ok({ username: session.username });
}
