/**
 * Shared types for the red-team scan proxy + findings → tickets flow.
 *
 * The browser sends a RedTeamScanRequest to OUR proxy (/api/redteam/scan); the
 * proxy SigV4-signs the call to the AWS Lambda Function URL and returns a
 * RedTeamScanResponse. AWS credentials never reach the client.
 *
 * Wire quirks of the real Lambda (see docs/lambda-scan-proxy.md):
 *   - `severity` is LOWERCASE and includes "info".
 *   - `summary` carries ONLY { total, critical } — derive the rest from findings.
 */

export type RedTeamScanRequest = {
  target: string;
  scope?: string[];
  agents?: number;
  // Local metadata only — IGNORED by the Lambda, but kept for ticket context:
  attacker_id?: string;
  attacker_name?: string;
  safe_mode?: boolean;
};

/** Wire format returned by the Lambda (LOWERCASE). */
export type RawSeverity = "critical" | "high" | "medium" | "low" | "info";

/** Normalized format used inside the app / tickets. */
export type TicketSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type RedTeamFinding = {
  title: string;
  severity: RawSeverity | string; // lowercase on the wire; normalize before use
  persona?: string;
  vector?: string;
  endpoint?: string;
  evidence?: string; // always a plain string from the Lambda
  poc?: string;
  remediation?: string;
  confirmed?: boolean;
};

/**
 * NOTE: the real Lambda sends ONLY { total, critical }. high/medium/low are
 * optional here — derive them from findings[], do not assume they exist.
 */
export type RedTeamScanSummary = {
  total: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
};

export type RedTeamScanResponse = {
  ok: boolean;
  target?: string;
  mode?: string;
  summary?: RedTeamScanSummary;
  findings?: RedTeamFinding[];
  run_id?: string;
  provider?: "mock" | "lambda";
  error?: string;
  message?: string;
};
