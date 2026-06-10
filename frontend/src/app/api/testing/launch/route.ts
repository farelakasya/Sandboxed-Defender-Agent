/**
 * Tier2 AI-Pentest launch proxy — the single route the frontend calls to start
 * a scan. The browser POSTs here; this route forwards to the attacker backend's
 * /scan endpoint server-side, adding the API key. The browser never talks to
 * the attacker backend / AWS directly, and the key is never exposed or logged.
 *
 * Contract:
 *   POST /api/testing/launch
 *   body: { ip, port, endpoint, authorized: true }
 *   → external: POST {ATTACKER_APP_BASE_URL}{ATTACKER_APP_SCAN_PATH}  (x-api-key)
 *   → mock: synthesize a QUEUED scan in the in-memory store
 *   response (202-style): { scan_id, status: "QUEUED" }
 *
 * Server-only env: ATTACKER_APP_BASE_URL, ATTACKER_APP_SCAN_PATH (default
 * /scan), ATTACKER_APP_API_KEY, ATTACKER_APP_AUTH_HEADER (x-api-key | bearer).
 */
import { NextResponse } from "next/server";
import {
  authHeaders,
  backendUrl,
  createMockScan,
  getBaseUrl,
  getMode,
  safeLabel,
  scanPath,
} from "@/lib/tier2-pentest.backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type LaunchBody = {
  ip?: unknown;
  port?: unknown;
  endpoint?: unknown;
  authorized?: unknown;
};

function err(message: string, error: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(req: Request) {
  let body: LaunchBody;
  try {
    body = (await req.json()) as LaunchBody;
  } catch {
    return err("Invalid JSON body.", "invalid_json", 400);
  }

  // ── validate (server-side) ────────────────────────────────
  const ip = typeof body.ip === "string" ? body.ip.trim() : "";
  const port = typeof body.port === "number" ? body.port : Number(body.port);
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";

  if (!ip) return err("`ip` is required.", "validation_error", 400);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return err("`port` must be an integer 1–65535.", "validation_error", 400);
  if (!endpoint.startsWith("/"))
    return err("`endpoint` must start with '/'.", "validation_error", 400);
  if (body.authorized !== true)
    return err(
      "`authorized` must be exactly true — you must confirm you are authorized to test this target.",
      "not_authorized",
      400
    );

  const payload = { ip, port, endpoint, authorized: true as const };

  // ── mock mode ─────────────────────────────────────────────
  if (getMode() !== "external") {
    const launched = createMockScan(payload);
    return NextResponse.json(launched, { status: 202 });
  }

  // ── external mode ─────────────────────────────────────────
  if (!getBaseUrl()) {
    return err(
      "External mode is enabled but ATTACKER_APP_BASE_URL is not configured.",
      "backend_not_configured",
      500
    );
  }
  const url = backendUrl(scanPath());
  if (!url) {
    return err(
      "ATTACKER_APP_BASE_URL is not a valid URL.",
      "invalid_backend_url",
      500
    );
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({}) as Record<string, unknown>);

    if (!upstream.ok) {
      const hint =
        upstream.status === 404
          ? " (check ATTACKER_APP_SCAN_PATH)"
          : upstream.status === 401 || upstream.status === 403
          ? " (check ATTACKER_APP_AUTH_HEADER / API key — or target not on allowlist)"
          : "";
      return NextResponse.json(
        {
          error: `upstream_${upstream.status}`,
          message: `Attacker backend ${safeLabel(url)} returned ${upstream.status}${hint}.`,
          upstream: data,
        },
        { status: 502 }
      );
    }

    // Normalize to { scan_id, status }. Backend returns scan_id + QUEUED on 202.
    const scan_id =
      typeof (data as Record<string, unknown>).scan_id === "string"
        ? ((data as Record<string, unknown>).scan_id as string)
        : "";
    if (!scan_id) {
      return NextResponse.json(
        {
          error: "no_scan_id",
          message: "Attacker backend did not return a scan_id.",
          upstream: data,
        },
        { status: 502 }
      );
    }
    const status =
      (data as Record<string, unknown>).status === "QUEUED" ? "QUEUED" : "QUEUED";
    return NextResponse.json({ scan_id, status }, { status: 202 });
  } catch (e) {
    console.error(
      "[testing/launch] external scan launch failed:",
      e instanceof Error ? e.name : "unknown"
    );
    return err(
      `Could not reach the attacker backend ${safeLabel(url)}.`,
      "fetch_failed",
      502
    );
  }
}
