import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { fail, ok } from "@/lib/utils/api-response";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Username and password are required.");
  }

  const env = getEnv();
  const valid =
    safeEqual(parsed.data.username, env.APP_USERNAME) &&
    safeEqual(parsed.data.password, env.APP_PASSWORD);

  if (!valid) {
    return fail("AUTH_FAILED", "Invalid credentials.", 401);
  }

  const token = await createSessionToken(parsed.data.username);
  const response = ok({ username: parsed.data.username });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function GET() {
  return NextResponse.json({ success: false }, { status: 405 });
}
