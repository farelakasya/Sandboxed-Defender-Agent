/**
 * Placeholder types for external async run-status polling.
 *
 * Stage 4 does NOT implement polling — no attacker-app status endpoint is known
 * yet. These types describe the generic shape we'd consume IF the attacker app's
 * launch response returns a poll URL. When that contract is confirmed, a small
 * client poller can fill the report in-place; until then the launch pages show
 * the "Run started. Waiting for attacker report or defender verdicts." state.
 */
import type { AttackerReport, AttackerReportStatus } from "./attacker-report.types";

export type AttackerRunStatus = {
  run_id: string;
  status: AttackerReportStatus;
  /** Optional URL to poll for status/report, if the attacker app provides one. */
  status_url?: string;
  /** Populated once the run completes and a report is available. */
  report?: AttackerReport;
  message?: string;
};

/**
 * Generic extractor: pull a poll URL from an arbitrary launch result if one of
 * the conventional fields is present. Returns null if none — callers must NOT
 * guess endpoint names.
 */
export function getRunStatusUrl(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const candidate = r.status_url ?? r.poll_url ?? r.run_status_url;
  return typeof candidate === "string" && candidate ? candidate : null;
}
