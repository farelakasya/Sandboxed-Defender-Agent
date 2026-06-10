type JsonBody = Record<string, unknown> | unknown[];

export class ApiClientError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

/**
 * Browser-facing base for defender backend calls.
 *
 * Default: the same-origin proxy at `/api/defender`, which forwards server-side
 * to the EC2 backend. This keeps HTTPS deploys mixed-content safe.
 *
 * Set NEXT_PUBLIC_DEFENDER_API_BASE_URL (or the legacy NEXT_PUBLIC_API_BASE_URL)
 * to a full origin to bypass the proxy and hit the backend directly — handy for
 * local debugging, but unsafe on HTTPS deploys.
 */
const PROXY_BASE = "/api/defender";

export function getApiBaseUrl(): string {
  const direct = (
    process.env.NEXT_PUBLIC_DEFENDER_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    ""
  )
    .trim()
    .replace(/\/$/, "");
  return direct || PROXY_BASE;
}

export function useMockData(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
}

/**
 * Whether `getApiBaseUrl()` points at the same-origin proxy. When true, the
 * service paths must be translated from the backend's `/api/...`/`/health`
 * shape into the proxy's `/api/defender/...` shape (see `buildUrl`).
 */
function usingProxy(): boolean {
  return getApiBaseUrl() === PROXY_BASE;
}

/**
 * Translate a backend path (`/health`, `/api/tickets`, ...) into the path under
 * the proxy base. The proxy strips a single leading `/api` and serves `health`
 * at its root, so:
 *   /health          → /api/defender/health
 *   /api/tickets     → /api/defender/tickets
 *   /api/dashboard/x → /api/defender/dashboard/x
 */
function toProxyPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/health") return "/health";
  return p.replace(/^\/api(?=\/)/, "");
}

function buildUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiClientError(
      "Defender backend base URL is not configured. Using mock/local data."
    );
  }
  const suffix = usingProxy()
    ? toProxyPath(path)
    : path.startsWith("/")
      ? path
      : `/${path}`;
  return `${baseUrl}${suffix}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.message === "string"
          ? data.message
          : `Backend request failed with ${res.status} ${res.statusText}`;
    throw new ApiClientError(message, res.status);
  }
  return data as T;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown network error";
    throw new ApiClientError(`Backend unavailable: ${detail}`);
  }

  try {
    return await readJson<T>(res);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError("Backend returned invalid JSON.", res.status);
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}

export function apiPatch<T>(path: string, body: JsonBody): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiPost<T>(path: string, body: JsonBody): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
