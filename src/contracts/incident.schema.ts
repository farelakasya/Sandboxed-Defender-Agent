import { z } from "zod";
import { SeveritySchema } from "./log.schema";
import { ThreatTypeSchema, DefenderActionTypeSchema } from "./classifier.schema";

export const IncidentStatusSchema = z.enum([
  "open",
  "investigating",
  "contained",
  "resolved",
  "dismissed",
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const DefenderActionRecordSchema = z.object({
  action_id: z.string(),
  action_type: DefenderActionTypeSchema,
  target: z.string(), // ip / user_id / endpoint, dummy only
  executed_at: z.string(),
  simulated: z.literal(true),
  note: z.string(),
});
export type DefenderActionRecord = z.infer<typeof DefenderActionRecordSchema>;

export const IncidentSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  title: z.string(),
  threat_type: ThreatTypeSchema,
  severity: SeveritySchema,
  status: IncidentStatusSchema,
  persona_name: z.string().nullable().optional(),
  log_ids: z.array(z.string()),
  recommended_action: DefenderActionTypeSchema,
  actions_taken: z.array(DefenderActionRecordSchema),
  summary: z.string(),
});
export type Incident = z.infer<typeof IncidentSchema>;

export const CreateIncidentRequestSchema = z.object({
  title: z.string().optional(),
  threat_type: ThreatTypeSchema,
  severity: SeveritySchema,
  persona_name: z.string().nullable().optional(),
  log_ids: z.array(z.string()).default([]),
  recommended_action: DefenderActionTypeSchema,
  summary: z.string().optional(),
});
export type CreateIncidentRequest = z.infer<typeof CreateIncidentRequestSchema>;

export const UpdateIncidentStatusSchema = z.object({
  status: IncidentStatusSchema,
});
export type UpdateIncidentStatus = z.infer<typeof UpdateIncidentStatusSchema>;
