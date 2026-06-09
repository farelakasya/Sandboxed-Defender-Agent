import { LogEvent } from "../contracts/log.schema";
import { ThreatType } from "../contracts/classifier.schema";

/**
 * Deterministic, rule-based pattern matching used by the fallback classifier.
 * Given a single LogEvent, decide which threat category best describes it.
 *
 * These rules are intentionally simple and explainable so the demo is
 * reproducible without invoking an LLM.
 */

const ADMIN_PATH = /^\/api\/admin\//i;
const LOGIN_PATH = /^\/api\/login$/i;
const REPORT_EXPORT_PATH = /^\/api\/reports\/export$/i;

export interface PatternResult {
  threat_type: ThreatType;
  rationale: string;
}

export function matchThreatPattern(log: LogEvent): PatternResult {
  const endpoint = log.endpoint || "";
  const role = log.role;

  // 1. Admin endpoint probing: anyone who is not an admin touching /api/admin/*
  if (ADMIN_PATH.test(endpoint) && role !== "admin") {
    return {
      threat_type: "admin_endpoint_probing",
      rationale: `Non-admin role "${role}" accessed admin endpoint ${endpoint} (status ${log.status_code}).`,
    };
  }

  // 2. Report export abuse: hitting the report export without auditor/admin.
  if (REPORT_EXPORT_PATH.test(endpoint) && role !== "admin" && role !== "auditor") {
    return {
      threat_type: "report_export_abuse",
      rationale: `Role "${role}" attempted bulk report export at ${endpoint}.`,
    };
  }

  // 3. Stale account abuse: a known stale/legacy account performing actions.
  // We detect this via a user_id naming convention or an explicit reason flag.
  if (isStaleAccount(log)) {
    return {
      threat_type: "stale_account_abuse",
      rationale: `Stale/legacy account "${log.user_id}" performed ${log.method} ${endpoint}.`,
    };
  }

  // 4. Credential stuffing: repeated/failed login attempts (heuristic by path).
  if (LOGIN_PATH.test(endpoint) && (log.status_code === 401 || log.status_code === 403 || !log.allowed)) {
    return {
      threat_type: "credential_stuffing_attempt",
      rationale: `Failed login attempt at ${endpoint} (status ${log.status_code}).`,
    };
  }

  // 5. Default: normal traffic.
  return {
    threat_type: "normal_traffic",
    rationale: `Request ${log.method} ${endpoint} by role "${role}" matched no threat pattern.`,
  };
}

function isStaleAccount(log: LogEvent): boolean {
  const uid = (log.user_id || "").toLowerCase();
  if (!uid) return false;
  return (
    uid.includes("stale") ||
    uid.includes("legacy") ||
    uid.includes("former") ||
    uid.startsWith("ex-")
  );
}
