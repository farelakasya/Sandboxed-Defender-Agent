import { z } from "zod";

/**
 * A structured security log event. Every simulated attacker request produces
 * exactly one of these, and the Defender Agent reads them to classify threats.
 */
export const RoleSchema = z.enum([
  "external",
  "admin",
  "rm",
  "sales",
  "lead_gen",
  "auditor",
  "unknown",
]);
export type Role = z.infer<typeof RoleSchema>;

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const LogEventSchema = z.object({
  log_id: z.string(),
  timestamp: z.string(), // ISO 8601
  persona_name: z.string().nullable().optional(),
  method: HttpMethodSchema,
  endpoint: z.string(),
  role: RoleSchema,
  user_id: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  user_agent: z.string(),
  status_code: z.number().int(),
  allowed: z.boolean(),
  reason: z.string(),
  // Optional enrichment fields populated by the normalizer / classifier.
  sensitivity: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
  source: z.string().default("simulation"),
});
export type LogEvent = z.infer<typeof LogEventSchema>;

/**
 * Permissive shape for externally ingested logs (e.g. nginx-style records)
 * that the normalizer converts into a canonical LogEvent.
 */
export const RawLogIngestSchema = z.object({
  timestamp: z.string().optional(),
  method: z.string().optional(),
  endpoint: z.string().optional(),
  path: z.string().optional(),
  role: z.string().optional(),
  user_id: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  user_agent: z.string().optional(),
  status_code: z.union([z.number(), z.string()]).optional(),
  persona_name: z.string().nullable().optional(),
  reason: z.string().optional(),
  allowed: z.boolean().optional(),
});
export type RawLogIngest = z.infer<typeof RawLogIngestSchema>;
