import { AttackerPersona, AttackerPersonaSchema } from "../contracts/agent.schema";
import { store } from "./store";

/**
 * Persona service: holds the canonical AttackerPersona list that the Bedrock
 * Attacker Agent reads from. Populated either by importing MiroFish output
 * (see mirofishImport.service.ts) or directly via the personas route.
 */

export function setPersonas(personas: AttackerPersona[]): AttackerPersona[] {
  // Replace the whole set; validate each entry defensively.
  store.personas = personas.map((p) => AttackerPersonaSchema.parse(p));
  return store.personas;
}

export function upsertPersonas(personas: AttackerPersona[]): AttackerPersona[] {
  for (const raw of personas) {
    const p = AttackerPersonaSchema.parse(raw);
    const idx = store.personas.findIndex(
      (existing) => existing.persona_name === p.persona_name
    );
    if (idx >= 0) store.personas[idx] = p;
    else store.personas.push(p);
  }
  return store.personas;
}

export function listPersonas(): AttackerPersona[] {
  return store.personas;
}

export function getPersona(personaName: string): AttackerPersona | undefined {
  return store.personas.find((p) => p.persona_name === personaName);
}
