import type { AttackerPersona } from "./attacker.types";
import type { AttackType } from "./redteam.types";

/**
 * Builds the payload the simulation setup UI would POST to kick off a Bedrock
 * red-team run. Pure + framework-free so it is trivially testable.
 *
 * SAFE SIMULATION: this only describes a run; it performs nothing itself.
 */

export type SimulationTarget = {
  /** Base URL of the app under (simulated) attack, e.g. http://localhost:3001 */
  base_url: string;
  /** Environment label — always a non-production demo for the hackathon. */
  environment: "demo";
  /** Optional specific endpoint the user picked to focus the run. */
  selected_endpoint?: string;
};

export type SimulationLaunchPayload = {
  target: {
    base_url: string;
    environment: "demo";
    selected_endpoint?: string;
  };
  attacker: {
    id: string;
    name: string;
    category?: AttackerPersona["category"];
    default_attack_type?: AttackType;
    supported_attack_types?: AttackType[];
  };
};

/**
 * buildSimulationLaunchPayload — assemble the launch payload from the selected
 * target + attacker persona. Returns the structured payload the collaborator's
 * Bedrock launcher expects.
 */
export function buildSimulationLaunchPayload(
  target: SimulationTarget,
  attacker: AttackerPersona
): SimulationLaunchPayload {
  return {
    target: {
      base_url: target.base_url,
      environment: "demo",
      selected_endpoint: target.selected_endpoint,
    },
    attacker: {
      // Prefer id over display name for all downstream logic.
      id: attacker.id,
      name: attacker.name,
      category: attacker.category,
      default_attack_type: attacker.default_attack_type,
      supported_attack_types: attacker.supported_attack_types,
    },
  };
}

/**
 * Whether the launch button should be enabled. Disabled while attackers are
 * loading or until both a target and an attacker are selected.
 */
export function canLaunchSimulation(args: {
  hasTarget: boolean;
  hasAttacker: boolean;
  attackersLoading: boolean;
}): boolean {
  return args.hasTarget && args.hasAttacker && !args.attackersLoading;
}

export const LAUNCH_HELPER_TEXT =
  "Select a target and attacker profile to launch the red-team simulation.";

// TODO(api): POST the payload from buildSimulationLaunchPayload() to
//   POST /api/redteam/launch
// to start a Bedrock run. The Bedrock attacker agent then issues controlled,
// simulated attacks against the selected target and reports each one to
//   POST /api/redteam/attack
// which classifies + stores the event for the client sync bridge to import.
