import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      success: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    },
    init
  );
}

export function fail(
  code: string,
  message: string,
  status = 400,
  init?: ResponseInit
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status, ...init }
  );
}
