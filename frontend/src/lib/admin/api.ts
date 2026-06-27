const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function saveToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_token");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const url = new URL(`${BASE}/api/admin${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail ?? "Request failed");
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function adminLogin(username: string, password: string) {
  const data = await req<{ token: string }>("POST", "/auth/login", { username, password });
  saveToken(data.token);
  return data;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
export async function getStats() {
  return req<{
    total_users: number;
    total_listings: number;
    total_agencies: number;
    total_projects: number;
    total_shared_housing: number;
    total_blog_posts: number;
    total_leads: number;
    flagged_listings: number;
    pending_listings: number;
    active_listings: number;
    total_verified_sellers: number;
  }>("GET", "/stats");
}

// ── Generic paginated list ────────────────────────────────────────────────────
export interface PagedResult<T = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

type Params = Record<string, string | number | boolean | undefined>;

export async function listItems<T = Record<string, unknown>>(
  section: string,
  params?: Params
): Promise<PagedResult<T>> {
  return req<PagedResult<T>>("GET", `/${section}`, undefined, params);
}

export async function getItem<T = Record<string, unknown>>(section: string, id: string): Promise<T> {
  return req<T>("GET", `/${section}/${id}`);
}

export async function createItem<T = Record<string, unknown>>(section: string, body: unknown): Promise<T> {
  return req<T>("POST", `/${section}`, body);
}

export async function getAdminSignedUploadUrl(bucket: string, filename: string) {
  return req<{ upload_url: string; public_url: string }>("POST", "/uploads/signed-url", {
    bucket,
    filename,
  });
}

export async function updateItem<T = Record<string, unknown>>(
  section: string,
  id: string,
  body: unknown
): Promise<T> {
  return req<T>("PUT", `/${section}/${id}`, body);
}

export async function deleteItem(section: string, id: string): Promise<{ message: string }> {
  return req<{ message: string }>("DELETE", `/${section}/${id}`);
}

// ── Fraud ─────────────────────────────────────────────────────────────────────
export async function approveListing(listingId: string) {
  return req<{ message: string; listing: Record<string, unknown> }>("PUT", `/listings/${listingId}/approve`);
}

export async function rejectListing(listingId: string, reason: string) {
  return req<{ message: string; reason: string; listing: Record<string, unknown> }>(
    "PUT",
    `/listings/${listingId}/reject`,
    { reason }
  );
}

export async function reviewFraud(listingId: string, action: "approve" | "reject") {
  return req<{ message: string }>("PUT", `/fraud/${listingId}`, { action });
}
