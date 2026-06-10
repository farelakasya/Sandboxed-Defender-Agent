/**
 * Same-origin proxy to the defender backend (source of truth).
 *
 * The browser calls `/api/defender/*` and this route forwards server-side to
 * `${DEFENDER_BACKEND_URL}/*`. Keeping the hop server-side means HTTPS deploys
 * (e.g. Vercel) never make a plain-HTTP request to the EC2 backend, which the
 * browser would block as mixed content.
 *
 * Path mapping (browser → backend):
 *   GET   /api/defender/health                       → GET   /health
 *   GET   /api/defender/tickets?limit&offset         → GET   /api/tickets?limit&offset
 *   GET   /api/defender/tickets/:id                  → GET   /api/tickets/:id
 *   PATCH /api/defender/tickets/:id/status           → PATCH /api/tickets/:id/status
 *   GET   /api/defender/dashboard/metrics            → GET   /api/dashboard/metrics
 *   GET   /api/defender/dashboard/per-ip?limit       → GET   /api/dashboard/per-ip?limit
 *
 * Rule: `health` maps to `/health`; everything else is prefixed with `/api/`.
 * Query string and JSON body are preserved; the backend status code + JSON are
 * returned verbatim. Errors are surfaced as clean JSON (no stack traces).
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendBaseUrl(): string {
  const url =
    process.env.DEFENDER_BACKEND_URL ??
    process.env.NEXT_PUBLIC_DEFENDER_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "";
  return url.trim().replace(/\/$/, "");
}

/** Translate the proxy path segments into the backend path. */
function toBackendPath(segments: string[]): string {
  const joined = segments.map(encodeURIComponent).join("/");
  // `health` lives at the backend root; everything else under `/api/`.
  if (joined === "health") return "/health";
  return `/api/${joined}`;
}

async function forward(
  req: NextRequest,
  segments: string[]
): Promise<NextResponse> {
  const base = backendBaseUrl();
  if (!base) {
    return NextResponse.json(
      { error: "DEFENDER_BACKEND_URL is not configured." },
      { status: 502 }
    );
  }

  const search = req.nextUrl.search; // preserves ?limit=&offset=
  const target = `${base}${toBackendPath(segments)}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: { Accept: "application/json" },
    cache: "no-store",
  };

  // Forward a JSON body for write methods (PATCH/POST/PUT).
  if (req.method !== "GET" && req.method !== "HEAD") {
    const body = await req.text();
    if (body) {
      init.body = body;
      (init.headers as Record<string, string>)["Content-Type"] =
        "application/json";
    }
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch (err) {
    // Never leak stack traces; log server-side only.
    console.error("[defender-proxy] upstream unreachable:", target, err);
    return NextResponse.json(
      { error: "Defender backend unavailable." },
      { status: 502 }
    );
  }

  const text = await res.text();
  // Pass the upstream status through; default to JSON content type.
  return new NextResponse(text || null, {
    status: res.status,
    headers: {
      "Content-Type":
        res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

type Ctx = { params: { path: string[] } };

export function GET(req: NextRequest, { params }: Ctx) {
  return forward(req, params.path ?? []);
}

export function PATCH(req: NextRequest, { params }: Ctx) {
  return forward(req, params.path ?? []);
}

export function POST(req: NextRequest, { params }: Ctx) {
  return forward(req, params.path ?? []);
}

export function PUT(req: NextRequest, { params }: Ctx) {
  return forward(req, params.path ?? []);
}
