import { z } from "zod";

/**
 * Shape of the raw output produced by MiroFish. MiroFish is the upstream
 * persona generator; the backend imports its output and converts each entry
 * into an AttackerPersona (see persona.service.ts).
 */
export const MiroFishPersonaSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  goal: z.string().optional(),
  // MiroFish may use slightly different vocabularies; we keep these loose and
  // normalize during import.
  access: z.string().optional(),
  intent: z.string().optional(),
  skill: z.string().optional(),
  risk: z.string().optional(),
  targets: z.array(z.string()).optional(),
  tactics: z.array(z.string()).optional(),
});
export type MiroFishPersona = z.infer<typeof MiroFishPersonaSchema>;

export const MiroFishOutputSchema = z.object({
  generator: z.literal("mirofish").optional(),
  generated_at: z.string().optional(),
  personas: z.array(MiroFishPersonaSchema),
});
export type MiroFishOutput = z.infer<typeof MiroFishOutputSchema>;
