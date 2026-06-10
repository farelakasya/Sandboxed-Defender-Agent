type JsonBody = Record<string, unknown> | unknown[];

export class ApiClientError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
}

export function useMockData(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
}

function buildUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiClientError(
      "NEXT_PUBLIC_API_BASE_URL is not configured. Using mock/local data."
    );
  }
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
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
