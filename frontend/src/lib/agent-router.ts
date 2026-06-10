/**
 * Agent registry / router (server-side).
 *
 * Maps a selected vector to the correct agent + provider, and builds the
 * AgentCommand. The frontend only sends vector_id + target + options; THIS layer
 * (called from the API route) enriches it. Never imported by a client component.
 */
import { ALL_VECTORS } from "@/data/testingVectors";
import type {
  AgentCommand,
  AgentProvider,
  SimulationLaunchRequest,
  SimulationTarget,
  SimulationVector,
} from "./testing-launch.types";
import { buildAgentCommand as buildCommandForVector } from "./agent-command.builder";

/** Look up a vector by id across both attack + fraud libraries. */
export function getVectorById(vectorId: string): SimulationVector | null {
  return ALL_VECTORS.find((v) => v.id === vectorId) ?? null;
}

/**
 * Resolve the agent + provider for a vector.
 *
 * MVP routing: all attack vectors → "attack-simulation-agent", all fraud
 * vectors → "fraud-simulation-agent". The provider is "mock" or
 * "collaborator_api" depending on TESTING_AGENT_MODE (resolved by the route);
 * here we report the default external provider as "collaborator_api".
 *
 * Future specialized routing (documented, not yet active):
 *   card_cracking        → payment-fraud-agent
 *   account_takeover     → auth-abuse-agent
 *   promo_abuse          → business-logic-abuse-agent
 *   admin_endpoint_probing → api-attack-agent
 *   credential_stuffing  → auth-attack-agent
 */
export function getAgentForVector(vector: SimulationVector): {
  agent_id: string;
  provider: AgentProvider;
} {
  return {
    agent_id: vector.default_agent_id,
    provider: "collaborator_api",
  };
}

function newRunId(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `RUN-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/**
 * Build the full AgentCommand for a launch. Generates the run_id, resolves the
 * agent, and delegates strategy construction to the per-vector command builder.
 */
export function buildAgentCommand(input: {
  vector: SimulationVector;
  target: SimulationTarget;
  options?: SimulationLaunchRequest["options"];
  appBaseUrl: string;
  runId?: string;
}): AgentCommand {
  const { agent_id } = getAgentForVector(input.vector);
  return buildCommandForVector({
    vector: input.vector,
    target: input.target,
    options: input.options,
    appBaseUrl: input.appBaseUrl,
    runId: input.runId ?? newRunId(),
    agentId: agent_id,
  });
}

/** Validate the target's type is supported by the vector. */
export function targetSupportedByVector(
  vector: SimulationVector,
  target: SimulationTarget
): boolean {
  return vector.target_types.includes(target.target_type);
}

export { newRunId };
