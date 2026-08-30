export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function apiClient<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    let body: Record<string, unknown>;
    let message: string;
    try {
      body = JSON.parse(text);
      message = String(body.message || text);
    } catch {
      body = { message: text };
      message = text;
    }
    const err = new Error(`API error ${res.status}: ${JSON.stringify(body)}`) as Error & Record<string, unknown>;
    err.status = res.status;
    if (body.code) err.code = body.code;
    if (body.field) err.field = body.field;
    if (body.retry_after) err.retry_after = body.retry_after;
    err.userMessage = message;
    throw err;
  }

  return res.json();
}