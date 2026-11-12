// HTTP-anrop för inloggning och lösenord.
import type { Me } from "../shared/protocol.ts";

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* tomt svar */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Något gick fel (${res.status}).`;
    throw new Error(msg);
  }
  return data as T;
}

export const login = (email: string, password: string) => post<{ ok: true; me: Me }>("/api/login", { email, password });
export const logout = () => post<{ ok: true }>("/api/logout");
export const changePassword = (current: string, next: string) => post<{ ok: true }>("/api/password", { current, next });
