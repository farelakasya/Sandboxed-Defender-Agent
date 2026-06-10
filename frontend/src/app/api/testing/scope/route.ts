/**
 * Tier2 AI-Pentest scope proxy — preset attack targets for the launch panel.
 *
 *   GET /api/testing/scope
 *   → external: GET {ATTACKER_APP_BASE_URL}{ATTACKER_APP_SCOPE_PATH}  (x-api-key)
 *   → mock: a static demo list
 *   response: { scope: string[] }   // "host:port" presets
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
  normalizeScope,
  readMockScope,
  safeLabel,
  scopePath,
} from "@/lib/tier2-pentest.backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(message: string, error: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

export async function GET() {
  // ── mock mode ─────────────────────────────────────────────
  if (getMode() !== "external") {
    return NextResponse.json({ scope: readMockScope() }, { status: 200 });
  }

  // ── external mode ─────────────────────────────────────────
  if (!getBaseUrl()) {
    return err(
      "External mode is enabled but ATTACKER_APP_BASE_URL is not configured.",
      "backend_not_configured",
      500
    );
  }
  const url = backendUrl(scopePath());
  if (!url) return err("Invalid backend URL.", "invalid_backend_url", 500);

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", ...authHeaders() },
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => ({}) as Record<string, unknown>);

    if (!upstream.ok) {
      if (upstream.status === 403)
        return err("Forbidden — check API key / authorization.", "forbidden", 403);
      return err(
        `Attacker backend ${safeLabel(url)} returned ${upstream.status}.`,
        `upstream_${upstream.status}`,
        502
      );
    }
    return NextResponse.json({ scope: normalizeScope(data) }, { status: 200 });
  } catch (e) {
    console.error(
      "[testing/scope] external scope fetch failed:",
      e instanceof Error ? e.name : "unknown"
    );
    return err(
      `Could not reach the attacker backend ${safeLabel(url)}.`,
      "fetch_failed",
      502
    );
  }
}
