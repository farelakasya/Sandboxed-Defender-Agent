import { Severity } from "../contracts/log.schema";
import { ThreatType, DefenderActionType } from "../contracts/classifier.schema";

/**
 * The canonical mapping from threat type -> severity -> recommended dummy
 * defender action. Centralizing this keeps the fallback classifier and the
 * Bedrock prompt instructions in agreement.
 *
 *   admin_endpoint_probing       -> HIGH     -> block_ip
 *   credential_stuffing_attempt  -> MEDIUM   -> rate_limit_ip
 *   report_export_abuse          -> CRITICAL -> notify_admin
 *   stale_account_abuse          -> CRITICAL -> flag_user
 *   normal_traffic               -> LOW      -> none
 */
export interface SeverityRule {
  severity: Severity;
  recommended_action: DefenderActionType;
}

export const SEVERITY_RULES: Record<ThreatType, SeverityRule> = {
  admin_endpoint_probing: { severity: "HIGH", recommended_action: "block_ip" },
  credential_stuffing_attempt: {
    severity: "MEDIUM",
    recommended_action: "rate_limit_ip",
  },
  report_export_abuse: { severity: "CRITICAL", recommended_action: "notify_admin" },
  stale_account_abuse: { severity: "CRITICAL", recommended_action: "flag_user" },
  normal_traffic: { severity: "LOW", recommended_action: "none" },
};

export function ruleForThreat(threat: ThreatType): SeverityRule {
  return SEVERITY_RULES[threat];
}

/** Severities that warrant opening an incident. */
const INCIDENT_SEVERITIES: Severity[] = ["MEDIUM", "HIGH", "CRITICAL"];

export function shouldCreateIncident(severity: Severity): boolean {
  return INCIDENT_SEVERITIES.includes(severity);
}
