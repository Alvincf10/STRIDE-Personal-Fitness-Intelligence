export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta: { timestamp: string };
};

export type ApiFailure = {
  success: false;
  error: { code: string; message: string };
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const json = (await res.json()) as ApiSuccess<T> | ApiFailure;
  if (!res.ok || !json.success) {
    const message =
      !json.success ? json.error.message : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json.data;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as ApiSuccess<T> | ApiFailure;
  if (!res.ok || !json.success) {
    const message =
      !json.success ? json.error.message : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json.data;
}
