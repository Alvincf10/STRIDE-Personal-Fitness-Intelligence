import { SESSION_COOKIE } from "@/lib/auth/session";
import { ok } from "@/lib/utils/api-response";

export async function POST() {
  const response = ok({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
