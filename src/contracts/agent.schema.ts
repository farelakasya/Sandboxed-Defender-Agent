import { z } from "zod";

/**
 * The AttackerPersona is the canonical, normalized persona used by the
 * Bedrock Attacker Agent to drive simulated API requests.
 */
export const AccessTypeSchema = z.enum([
  "external",
  "internal",
  "admin",
  "stale_account",
]);
export type AccessType = z.infer<typeof AccessTypeSchema>;

export const IntentSchema = z.enum(["curious", "careless", "malicious"]);
export type Intent = z.infer<typeof IntentSchema>;

export const LevelSchema = z.enum(["low", "medium", "high"]);
export type Level = z.infer<typeof LevelSchema>;

export const AttackerPersonaSchema = z.object({
  persona_name: z.string(),
  goal: z.string(),
  access_type: AccessTypeSchema,
  intent: IntentSchema,
  skill_level: LevelSchema,
  risk_appetite: LevelSchema,
  target_assets: z.array(z.string()),
  preferred_tactics: z.array(z.string()),
});
export type AttackerPersona = z.infer<typeof AttackerPersonaSchema>;
