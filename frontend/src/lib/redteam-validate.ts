import type {
  ActorType,
  AttackType,
  HttpMethod,
  SimulationAttackRequest,
} from "./redteam.types";

/**
 * Lightweight runtime validation for inbound red-team payloads. Kept dependency
 * free (no zod) and shared between /api/redteam/attack and the dummy targets.
 */

const ATTACK_TYPES: AttackType[] = [
  "admin_endpoint_probing",
  "credential_stuffing",
  "report_export_abuse",
  "stale_account_abuse",
  "insider_data_access",
  "network_recon",
  "dns_spoofing",
  "smtp_relay_abuse",
  "firewall_bypass",
  "web_exploit",
];

const ACTOR_TYPES: ActorType[] = [
  "external",
  "internal",
  "stale_account",
  "unknown",
];

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export type ValidationResult =
  | { ok: true; value: SimulationAttackRequest }
  | { ok: false; errors: string[] };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Validate + coerce an unknown body into a SimulationAttackRequest. */
export function validateAttackRequest(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObj(raw)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }

  const run_id =
    typeof raw.run_id === "string" && raw.run_id.trim()
      ? raw.run_id
      : `RUN-${Date.now().toString(36)}`;

  const attack_type = raw.attack_type;
  if (!ATTACK_TYPES.includes(attack_type as AttackType)) {
    errors.push(
      `attack_type must be one of: ${ATTACK_TYPES.join(", ")} (got ${String(
        attack_type
      )})`
    );
  }

  const attacker = isObj(raw.attacker) ? raw.attacker : {};
  let actor_type = attacker.actor_type as ActorType;
  if (!ACTOR_TYPES.includes(actor_type)) {
    // Default to "unknown" rather than rejecting — keep the sim resilient.
    actor_type = "unknown";
  }

  const target = isObj(raw.target) ? raw.target : null;
  if (!target) {
    errors.push("target is required");
  }
  const method = target?.method as HttpMethod;
  if (target && !METHODS.includes(method)) {
    errors.push(`target.method must be one of: ${METHODS.join(", ")}`);
  }
  const endpoint = target?.endpoint;
  if (target && (typeof endpoint !== "string" || !endpoint.trim())) {
    errors.push("target.endpoint is required");
  }

  if (errors.length > 0) return { ok: false, errors };

  const metadata = isObj(raw.metadata) ? raw.metadata : undefined;

  const value: SimulationAttackRequest = {
    run_id,
    attack_id: typeof raw.attack_id === "string" ? raw.attack_id : undefined,
    attack_type: attack_type as AttackType,
    attacker: {
      persona_name:
        typeof attacker.persona_name === "string"
          ? attacker.persona_name
          : undefined,
      actor_type,
      source_ip:
        typeof attacker.source_ip === "string" ? attacker.source_ip : undefined,
      user_id:
        typeof attacker.user_id === "string" ? attacker.user_id : undefined,
      user_agent:
        typeof attacker.user_agent === "string"
          ? attacker.user_agent
          : undefined,
    },
    target: {
      method: method as HttpMethod,
      endpoint: endpoint as string,
      asset:
        typeof target!.asset === "string" ? (target!.asset as string) : undefined,
    },
    metadata: metadata
      ? {
          confidence:
            typeof metadata.confidence === "number"
              ? metadata.confidence
              : undefined,
          notes:
            typeof metadata.notes === "string" ? metadata.notes : undefined,
        }
      : undefined,
  };

  return { ok: true, value };
}
