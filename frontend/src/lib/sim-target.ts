import { NextResponse } from "next/server";
import type {
  ActorType,
  AttackType,
  HttpMethod,
  SimulationAttackRequest,
} from "./redteam.types";
import {
  classifyAttackRequest,
  resolveSimulatedStatusCode,
} from "./redteam-classifier";
import { addRedTeamEvent } from "./redteam-event-store";

/**
 * Shared helper for the dummy /api/sim-target/* endpoints.
 *
 * Each dummy target route is a controlled, SAFE stand-in that Bedrock can hit
 * directly. It exposes NO real data. The flow for every target:
 *   1. accept the request
 *   2. read attacker hints from headers / body (or defaults)
 *   3. synthesize a SimulationAttackRequest
 *   4. determine the simulated status code
 *   5. classify into a SimulationIncidentEvent + store it
 *   6. return a simulated response JSON at the simulated status code
 *
 * SAFETY: no real auth, no real data, no enforcement. Status codes are
 * descriptive of how a hardened system would respond — they are simulated.
 */

export type SimTargetConfig = {
  attack_type: AttackType;
  asset: string;
  /** Fallback actor when the caller sends no hint. */
  defaultActor?: ActorType;
};

/** Read an optional JSON body without throwing on empty/invalid bodies. */
async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const ACTOR_TYPES: ActorType[] = [
  "external",
  "internal",
  "stale_account",
  "unknown",
];

/**
 * Resolve the simulated attacker from request headers / body. Bedrock can pass
 * hints via headers (x-sim-actor-type, x-sim-persona, x-sim-user-id) or body.
 */
function resolveAttacker(
  request: Request,
  body: Record<string, unknown>,
  fallback: ActorType
): SimulationAttackRequest["attacker"] {
  const h = request.headers;
  const bodyAttacker =
    body.attacker && typeof body.attacker === "object"
      ? (body.attacker as Record<string, unknown>)
      : {};

  const headerActor = h.get("x-sim-actor-type") as ActorType | null;
  const bodyActor = bodyAttacker.actor_type as ActorType | undefined;
  const actor_type: ActorType =
    headerActor && ACTOR_TYPES.includes(headerActor)
      ? headerActor
      : bodyActor && ACTOR_TYPES.includes(bodyActor)
      ? bodyActor
      : fallback;

  const user_id =
    h.get("x-sim-user-id") ??
    (typeof bodyAttacker.user_id === "string"
      ? (bodyAttacker.user_id as string)
      : undefined) ??
    undefined;

  return {
    persona_name:
      h.get("x-sim-persona") ??
      (typeof bodyAttacker.persona_name === "string"
        ? (bodyAttacker.persona_name as string)
        : undefined) ??
      undefined,
    actor_type,
    source_ip:
      h.get("x-forwarded-for")?.split(",")[0].trim() ??
      h.get("x-sim-source-ip") ??
      "203.0.113.50",
    user_id,
    user_agent: h.get("user-agent") ?? "Bedrock-RedTeam-Agent",
  };
}

/** Friendly, data-free body for each simulated status code. */
function simulatedBody(statusCode: number, asset: string) {
  if (statusCode >= 500) {
    return { error: "simulated server error", asset };
  }
  if (statusCode === 403) {
    return { error: "forbidden", message: "Access denied (simulated).", asset };
  }
  if (statusCode === 401) {
    return {
      error: "unauthorized",
      message: "Authentication failed (simulated).",
      asset,
    };
  }
  return {
    message: "OK (simulated). No real data is exposed by this endpoint.",
    asset,
  };
}

/**
 * Run a dummy target: synthesize → classify → store → respond. Returns a
 * NextResponse at the simulated status code, with the classified event attached
 * so callers can inspect it.
 */
export async function handleSimTarget(
  request: Request,
  method: HttpMethod,
  endpoint: string,
  config: SimTargetConfig
): Promise<NextResponse> {
  const body = await readJson(request);
  const attacker = resolveAttacker(
    request,
    body,
    config.defaultActor ?? "external"
  );

  const run_id =
    (typeof body.run_id === "string" && body.run_id) ||
    request.headers.get("x-sim-run-id") ||
    `RUN-${Date.now().toString(36)}`;

  const attackRequest: SimulationAttackRequest = {
    run_id,
    attack_type: config.attack_type,
    attacker,
    target: { method, endpoint, asset: config.asset },
    metadata: {
      notes: `Simulated hit on dummy target ${endpoint}`,
    },
  };

  const statusCode = resolveSimulatedStatusCode(attackRequest);
  const event = classifyAttackRequest(attackRequest);
  addRedTeamEvent(event);

  return NextResponse.json(
    {
      simulated: true,
      status_code: statusCode,
      event_id: event.event_id,
      defender_action: event.defender.action,
      ...simulatedBody(statusCode, config.asset),
    },
    { status: statusCode }
  );
}
