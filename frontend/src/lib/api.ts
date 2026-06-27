import { useAuthStore } from "@/stores/authStore";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
};

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
    public path?: string
  ) {
    const detail =
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
        ? ` - ${body.detail}`
        : "";
    super(`API Error ${status}: ${statusText}${path ? ` (${path})` : ""}${detail}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }

  // Inject auth token from the Zustand store (works outside React components)
  const token = useAuthStore.getState().session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-ID": crypto.randomUUID(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(API_BASE_URL.includes("ngrok") ? { "ngrok-skip-browser-warning": "true" } : {}),
    ...options.headers,
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    // Auto-logout on 401 — token expired or invalid
    if (res.status === 401 && useAuthStore.getState().session) {
      useAuthStore.getState().logout();
    }
    throw new ApiError(res.status, res.statusText, errorBody, path);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};

export { ApiError };

// Server-side fetch — no auth injection, 8-second timeout, for SSR use
export async function serverFetch<T>(
  path: string,
  options: { headers?: Record<string, string>; revalidate?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": crypto.randomUUID(),
        ...(API_BASE_URL.includes("ngrok") ? { "ngrok-skip-browser-warning": "true" } : {}),
        ...options.headers,
      },
      signal: controller.signal,
      next: options.revalidate !== undefined
        ? { revalidate: options.revalidate }
        : { revalidate: 60 },
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new ApiError(res.status, res.statusText, errorBody, path);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
