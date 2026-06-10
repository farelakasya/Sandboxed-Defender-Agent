/**
 * Server-side red-team scan proxy.
 *
 * Receives plain JSON from the frontend, SigV4-signs a request to the AWS Lambda
 * Function URL (in external mode), and returns findings. AWS credentials NEVER
 * reach the browser — the client only ever calls THIS route.
 *
 * SAFE SIMULATION: this app contains no real exploitation logic; the Lambda runs
 * the controlled scan. In mock mode no AWS call happens at all.
 */
import { NextResponse } from "next/server";
import { signAndSendLambdaFunctionUrl } from "@/lib/aws-sigv4";
import type {
  RedTeamScanRequest,
  RedTeamScanResponse,
  RedTeamFinding,
} from "@/lib/redteam-scan.types";

export const runtime = "nodejs"; // AWS SDK needs Node, not the Edge runtime
export const maxDuration = 300; // allow long waits on hosts that honor it

/** Extract "host:port" from a target URL for the default scope entry. */
function hostFromTarget(target: string): string {
  try {
    const u = new URL(target.includes("://") ? target : `http://${target}`);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return target;
  }
}

/**
 * Mock response shaped EXACTLY like the real Lambda: lowercase severities,
 * summary carrying only { total, critical }, provider "mock", a run_id, and a
 * spread of findings across severities.
 */
function mockResponse(target: string): RedTeamScanResponse {
  const findings: RedTeamFinding[] = [
    {
      title: "Broken Authentication - Login Rejects Valid Credentials",
      severity: "critical",
      vector: "llm",
      persona: "🔨 The Brute",
      endpoint: target,
      evidence:
        "Registration succeeds (user_id returned) but /login returns 401 for the same credentials.",
      poc: "POST /register -> 200; POST /login (same creds) -> 401 invalid credentials.",
      remediation:
        "Ensure password hashing/verification matches between registration and login.",
      confirmed: true,
    },
    {
      title: "No Rate Limiting on /login",
      severity: "high",
      vector: "llm",
      persona: "🏰 The Siege",
      endpoint: target,
      evidence:
        "Many rapid login attempts accepted without throttling or lockout.",
      poc: "Repeated POST /login with different credentials, no delay/blocking.",
      remediation:
        "Add rate limiting + account lockout + CAPTCHA after a threshold.",
      confirmed: true,
    },
    {
      title: "Permissive CORS (Access-Control-Allow-Origin: *)",
      severity: "medium",
      vector: "llm",
      persona: "🃏 The Trickster",
      endpoint: target,
      evidence: "All responses include access-control-allow-origin: *.",
      poc: "Any cross-origin request receives permissive CORS headers.",
      remediation: "Restrict CORS to specific trusted origins; add CSRF tokens.",
      confirmed: true,
    },
  ];

  const critical = findings.filter((f) => f.severity === "critical").length;

  return {
    ok: true,
    provider: "mock",
    run_id: `mock-${Date.now().toString(36)}`,
    target,
    mode: "llm-swarm",
    // Mirror the real Lambda: ONLY total + critical.
    summary: { total: findings.length, critical },
    findings,
  };
}

export async function POST(req: Request) {
  let payload: RedTeamScanRequest;
  try {
    payload = (await req.json()) as RedTeamScanRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 }
    );
  }

  const target = (payload?.target ?? "").trim();
  if (!target) {
    return NextResponse.json(
      { ok: false, error: "missing 'target'" },
      { status: 400 }
    );
  }

  // agents: default 5, clamp 1..10.
  const agents = Math.min(10, Math.max(1, Math.round(payload.agents ?? 5)));
  // scope defaults to the target host:port.
  const scope = payload.scope?.length ? payload.scope : [hostFromTarget(target)];

  const mode = process.env.REDTEAM_SCAN_MODE ?? "mock";

  // ---- mock mode: no AWS needed ----
  if (mode !== "external") {
    return NextResponse.json(mockResponse(target));
  }

  // ---- external mode: sign + forward to the Lambda ----
  const url = process.env.LAMBDA_FUNCTION_URL;
  if (!url) {
    // Generic message — never reveal config details.
    return NextResponse.json(
      { ok: false, error: "scan backend not configured" },
      { status: 500 }
    );
  }

  // AUTHORITATIVE body. The Lambda REQUIRES authorized:true and mode:"llm-swarm".
  // safe_mode / attacker_* are intentionally NOT forwarded (the Lambda ignores
  // them); they stay client-side as ticket metadata only.
  const lambdaBody = {
    target,
    authorized: true,
    scope,
    mode: "llm-swarm",
    agents,
  };

  const timeoutMs = Number(process.env.REDTEAM_SCAN_TIMEOUT_MS ?? 300_000);

  try {
    const res = await signAndSendLambdaFunctionUrl({
      url,
      region: process.env.AWS_REGION ?? "us-east-1",
      body: lambdaBody,
      timeoutMs,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          provider: "lambda",
          error: `lambda returned ${res.status}`,
          message: text.slice(0, 300), // truncated; never leak signing internals
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as RedTeamScanResponse;
    return NextResponse.json({ ...data, provider: "lambda" });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    // Never include AWS credentials or signing internals in the error.
    return NextResponse.json(
      { ok: false, error: aborted ? "scan timed out" : "scan failed" },
      { status: aborted ? 504 : 502 }
    );
  }
}
