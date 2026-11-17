import { fail } from "@/lib/utils/api-response";
import { getSession } from "@/lib/auth/session";

export async function requireApiSession() {
  const session = await getSession();
  if (!session) {
    return { session: null, error: fail("UNAUTHORIZED", "Access denied.", 401) };
  }
  return { session, error: null };
}
