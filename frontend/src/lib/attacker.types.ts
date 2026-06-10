/**
 * Attacker persona contract.
 *
 * The simulation setup UI loads these from GET /api/redteam/attackers (which
 * the collaborator's Bedrock service can later back). The frontend selects by
 * `id` — never by exact display name — so persona copy can change freely.
 */

import type { AttackType } from "./redteam.types";

export type AttackerCategory =
  | "external"
  | "internal"
  | "stale_account"
  | "bot"
  | "unknown";

export type AttackerLevel = "low" | "medium" | "high";

export type AttackerPersona = {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category?: AttackerCategory;
  skill_level?: AttackerLevel;
  risk_appetite?: AttackerLevel;
  default_attack_type?: AttackType;
  supported_attack_types?: AttackType[];
  tags?: string[];
};

/** Shape of GET /api/redteam/attackers. */
export type AttackersApiResponse = {
  attackers: AttackerPersona[];
};
