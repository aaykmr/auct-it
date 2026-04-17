/**
 * When unset, use same-origin `/v1/*` so Next.js rewrites can proxy to the API (avoids "Failed to fetch"
 * when the app is opened via LAN hostname while `127.0.0.1` would point at the wrong machine).
 * Set `NEXT_PUBLIC_API_URL` to a full URL when the API is on another host.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auctit_token");
}

export const AUTH_CHANGE_EVENT = "auctit-auth-change";

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("auctit_token", token);
  else localStorage.removeItem("auctit_token");
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export async function api<T>(
  path: string,
  opts?: RequestInit & { token?: string | null; json?: unknown },
): Promise<T> {
  const headers = new Headers(opts?.headers);
  if (opts?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const token = opts?.token ?? getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
      body: opts?.json !== undefined ? JSON.stringify(opts.json) : opts?.body,
    });
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message === "Failed to fetch"
        ? "Network error (is the API running? Next dev proxies /v1 to the API unless NEXT_PUBLIC_API_URL is set.)"
        : e instanceof Error
          ? e.message
          : "Request failed";
    throw new Error(msg);
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; hint?: string; message?: string };
    const parts = [err.error ?? err.message, err.hint].filter(Boolean);
    throw new Error(parts.join(". ") || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const apiUrl = API_BASE;
