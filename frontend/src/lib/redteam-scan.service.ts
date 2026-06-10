/**
 * Client-safe scan service. Calls ONLY our own proxy route — never the Lambda
 * directly (the Lambda needs AWS SigV4 signing, which must stay server-side).
 */
import type {
  RedTeamScanRequest,
  RedTeamScanResponse,
} from "./redteam-scan.types";

export async function scanTarget(
  payload: RedTeamScanRequest
): Promise<RedTeamScanResponse> {
  try {
    const res = await fetch("/api/redteam/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    // The proxy always returns JSON (even on errors), so parse and return it.
    return (await res.json()) as RedTeamScanResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}
