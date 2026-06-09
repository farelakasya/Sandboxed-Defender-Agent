import { LogEvent } from "../contracts/log.schema";
import { Classification } from "../contracts/classifier.schema";
import { matchThreatPattern } from "../utils/patternMatch";
import { ruleForThreat } from "../utils/severityRules";

/**
 * Deterministic rule-based fallback classifier. This is the safety net that
 * lets the demo run without invoking the Bedrock Defender Agent — and it
 * encodes the exact mapping the Defender Agent is instructed to follow:
 *
 *   admin_endpoint_probing       -> HIGH     -> block_ip
 *   credential_stuffing_attempt  -> MEDIUM   -> rate_limit_ip
 *   report_export_abuse          -> CRITICAL -> notify_admin
 *   stale_account_abuse          -> CRITICAL -> flag_user
 *   normal_traffic               -> LOW      -> none
 */
export function classifyLog(log: LogEvent): Classification {
  const { threat_type, rationale } = matchThreatPattern(log);
  const { severity, recommended_action } = ruleForThreat(threat_type);

  return {
    threat_type,
    severity,
    recommended_action,
    confidence: threat_type === "normal_traffic" ? 0.6 : 0.85,
    rationale,
    classifier: "rule_based_fallback",
  };
}
