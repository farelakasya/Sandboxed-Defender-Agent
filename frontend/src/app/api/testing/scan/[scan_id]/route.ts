/**
 * Tier2 AI-Pentest scan poll proxy.
 *
 *   GET /api/testing/scan/:scan_id
 *   → external: GET {ATTACKER_APP_BASE_URL}{ATTACKER_APP_SCAN_PATH}/:scan_id (x-api-key)
 *   → mock: advance + return the in-memory scan
 *   response: the Scan object as-is
 *
 * The browser never calls the attacker backend directly; the key stays
 * server-side and is never returned or logged. Errors are clean JSON.
 */
import { NextResponse } from "next/server";
import {
  authHeaders,
  backendUrl,
  getBaseUrl,
  getMode,
  readMockScan,
  safeLabel,
  scanPath,
} from "@/lib/tier2-pentest.backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(message: string, error: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: { scan_id: string } }
) {
  const scanId = params.scan_id;
  if (!scanId) return err("Missing scan_id.", "validation_error", 400);

  // ── mock mode ─────────────────────────────────────────────
  if (getMode() !== "external") {
    const scan = readMockScan(scanId);
    if (!scan) return err("Scan not found.", "not_found", 404);
    return NextResponse.json(scan, { status: 200 });
  }

  // ── external mode ─────────────────────────────────────────
  if (!getBaseUrl()) {
    return err(
      "External mode is enabled but ATTACKER_APP_BASE_URL is not configured.",
      "backend_not_configured",
      500
    );
  }
  const url = backendUrl(`${scanPath().replace(/\/$/, "")}/${encodeURIComponent(scanId)}`);
  if (!url) return err("Invalid backend URL.", "invalid_backend_url", 500);

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", ...authHeaders() },
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({}) as Record<string, unknown>);

    if (!upstream.ok) {
      if (upstream.status === 404) return err("Scan not found.", "not_found", 404);
      if (upstream.status === 403)
        return err("Forbidden — check API key / authorization.", "forbidden", 403);
      if (upstream.status === 400)
        return err("Invalid scan request.", "validation_error", 400);
      return err(
        `Attacker backend ${safeLabel(url)} returned ${upstream.status}.`,
        `upstream_${upstream.status}`,
        502
      );
    }
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error(
      "[testing/scan] external poll failed:",
      e instanceof Error ? e.name : "unknown"
    );
    return err(
      `Could not reach the attacker backend ${safeLabel(url)}.`,
      "fetch_failed",
      502
    );
  }
}
