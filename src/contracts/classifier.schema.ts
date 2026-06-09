import { z } from "zod";
import { SeveritySchema } from "./log.schema";

/**
 * Threat categories recognized by the rule-based fallback classifier and
 * (optionally) the Bedrock Defender Agent.
 */
export const ThreatTypeSchema = z.enum([
  "admin_endpoint_probing",
  "credential_stuffing_attempt",
  "report_export_abuse",
  "stale_account_abuse",
  "normal_traffic",
]);
export type ThreatType = z.infer<typeof ThreatTypeSchema>;

/**
 * Dummy (safe, simulated) defender actions. None of these perform real
 * infrastructure changes.
 */
export const DefenderActionTypeSchema = z.enum([
  "block_ip",
  "rate_limit_ip",
  "notify_admin",
  "flag_user",
  "none",
]);
export type DefenderActionType = z.infer<typeof DefenderActionTypeSchema>;

export const ClassificationSchema = z.object({
  threat_type: ThreatTypeSchema,
  severity: SeveritySchema,
  recommended_action: DefenderActionTypeSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  classifier: z.enum(["rule_based_fallback", "bedrock_defender_agent"]),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const ClassifyLogRequestSchema = z.object({
  log_id: z.string().optional(),
  log: z.unknown().optional(),
});
export type ClassifyLogRequest = z.infer<typeof ClassifyLogRequestSchema>;
