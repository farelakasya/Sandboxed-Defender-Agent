import { z } from "zod";
import { HttpMethodSchema, LogEventSchema } from "./log.schema";

/**
 * Roles required to access a simulation endpoint. Note this is the stricter
 * set (no "unknown") that an endpoint can demand.
 */
export const RequiredRoleSchema = z.enum([
  "external",
  "admin",
  "rm",
  "sales",
  "lead_gen",
  "auditor",
]);
export type RequiredRole = z.infer<typeof RequiredRoleSchema>;

export const SensitivitySchema = z.enum(["low", "medium", "high", "critical"]);
export type Sensitivity = z.infer<typeof SensitivitySchema>;

export const SimulationEndpointSchema = z.object({
  method: HttpMethodSchema,
  endpoint: z.string(),
  required_role: RequiredRoleSchema,
  sensitivity: SensitivitySchema,
  description: z.string(),
});
export type SimulationEndpoint = z.infer<typeof SimulationEndpointSchema>;

export const RequestRoleSchema = z.enum([
  "external",
  "admin",
  "rm",
  "sales",
  "lead_gen",
  "auditor",
  "unknown",
]);
export type RequestRole = z.infer<typeof RequestRoleSchema>;

export const SimulatedApiRequestSchema = z.object({
  persona_name: z.string(),
  method: HttpMethodSchema,
  endpoint: z.string(),
  role: RequestRoleSchema,
  user_agent: z.string(),
  ip: z.string().optional(),
  user_id: z.string().nullable().optional(),
});
export type SimulatedApiRequest = z.infer<typeof SimulatedApiRequestSchema>;

export const SimulatedApiResponseSchema = z.object({
  status_code: z.number().int(),
  allowed: z.boolean(),
  reason: z.string(),
  log_created: z.boolean(),
  log: LogEventSchema,
});
export type SimulatedApiResponse = z.infer<typeof SimulatedApiResponseSchema>;
