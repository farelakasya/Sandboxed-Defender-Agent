import {
  MiroFishOutput,
  MiroFishOutputSchema,
  MiroFishPersona,
} from "../contracts/mirofish.schema";
import {
  AttackerPersona,
  AccessType,
  Intent,
  Level,
} from "../contracts/agent.schema";
import { upsertPersonas } from "./persona.service";

/**
 * Converts raw MiroFish output into canonical AttackerPersonas and loads them
 * into the persona store. MiroFish vocabularies are normalized here so the
 * rest of the system only deals with the strict enums.
 */

function normalizeAccess(value?: string): AccessType {
  const v = (value || "").toLowerCase();
  if (v.includes("stale") || v.includes("dormant") || v.includes("former")) {
    return "stale_account";
  }
  if (v.includes("admin")) return "admin";
  if (v.includes("internal") || v.includes("employee") || v.includes("insider")) {
    return "internal";
  }
  return "external";
}

function normalizeIntent(value?: string): Intent {
  const v = (value || "").toLowerCase();
  if (v.includes("malic") || v.includes("hostile") || v.includes("attack")) {
    return "malicious";
  }
  if (v.includes("careless") || v.includes("negligent") || v.includes("sloppy")) {
    return "careless";
  }
  return "curious";
}

function normalizeLevel(value?: string): Level {
  const v = (value || "").toLowerCase();
  if (v.includes("high") || v.includes("expert") || v.includes("advanced")) {
    return "high";
  }
  if (v.includes("low") || v.includes("novice") || v.includes("basic")) {
    return "low";
  }
  return "medium";
}

export function miroFishPersonaToAttacker(p: MiroFishPersona): AttackerPersona {
  return {
    persona_name: p.name,
    goal: p.goal || p.description || `Operate as "${p.name}".`,
    access_type: normalizeAccess(p.access),
    intent: normalizeIntent(p.intent),
    skill_level: normalizeLevel(p.skill),
    risk_appetite: normalizeLevel(p.risk),
    target_assets: p.targets ?? [],
    preferred_tactics: p.tactics ?? [],
  };
}

export function importMiroFishOutput(raw: unknown): AttackerPersona[] {
  // Accept either the full MiroFish envelope or a bare persona array.
  let output: MiroFishOutput;
  if (Array.isArray(raw)) {
    output = MiroFishOutputSchema.parse({ personas: raw });
  } else {
    output = MiroFishOutputSchema.parse(raw);
  }
  const personas = output.personas.map(miroFishPersonaToAttacker);
  return upsertPersonas(personas);
}
