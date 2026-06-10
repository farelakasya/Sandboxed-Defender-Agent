/**
 * Agent command builders (server-side).
 *
 * Translate a (vector + target + options) into a concrete AgentCommand the
 * collaborator backend / Bedrock agent can execute. Per-vector builders supply a
 * tailored `strategy`; everything falls back to a generic builder.
 *
 * All commands are SAFE by construction: constraints carry the vector's
 * safe_constraints (safe_mode, no real credentials/payment, allowed targets).
 */
import type {
  AgentCommand,
  SimulationLaunchRequest,
  SimulationTarget,
  SimulationVector,
} from "./testing-launch.types";

export interface BuildInput {
  vector: SimulationVector;
  target: SimulationTarget;
  options?: SimulationLaunchRequest["options"];
  appBaseUrl: string;
  runId: string;
  agentId: string;
}

/** task slug per vector, e.g. card_cracking → simulate_card_cracking. */
export function taskForVector(vectorId: string): string {
  return `simulate_${vectorId}`;
}

function baseConstraints(
  vector: SimulationVector,
  options?: SimulationLaunchRequest["options"]
): AgentCommand["constraints"] {
  const sc = vector.safe_constraints;
  return {
    // Safe mode can never be turned OFF from the client — always force-true.
    safe_mode: true,
    max_steps: options?.max_steps ?? sc.max_steps ?? 5,
    max_attempts: options?.max_attempts ?? sc.max_attempts,
    no_real_credentials: sc.no_real_credentials ?? true,
    no_real_payment: sc.no_real_payment,
    allowed_targets_only: sc.allowed_targets_only ?? true,
  };
}

function baseCommand(input: BuildInput): AgentCommand {
  const { vector, target, options, appBaseUrl, runId, agentId } = input;
  return {
    run_id: runId,
    domain: vector.domain,
    agent_id: agentId,
    task: taskForVector(vector.id),
    vector_id: vector.id,
    vector_name: vector.name,
    target,
    strategy: {},
    constraints: baseConstraints(vector, options),
    callback: {
      event_url: `${appBaseUrl}/api/detection/events`,
    },
    expected_detection_labels: vector.expected_detection_labels,
  };
}

/* ----------------------------- per-vector ------------------------------- */

export function buildCardCrackingCommand(input: BuildInput): AgentCommand {
  const cmd = baseCommand(input);
  cmd.strategy = {
    attempt_pattern: "repeated_failed_authorizations",
    reuse_device_fingerprint: true,
    vary_dummy_card_token: true,
    velocity: "medium",
  };
  return cmd;
}

export function buildAccountTakeoverCommand(input: BuildInput): AgentCommand {
  const cmd = baseCommand(input);
  cmd.strategy = {
    attempt_pattern: "credential_replay",
    new_device_fingerprint: true,
    simulate_session_hijack: true,
    geo_change: true,
  };
  return cmd;
}

export function buildPromoAbuseCommand(input: BuildInput): AgentCommand {
  const cmd = baseCommand(input);
  cmd.strategy = {
    attempt_pattern: "multi_accounting",
    email_alias_variation: true,
    reuse_device_fingerprint: true,
    promo_stacking: true,
  };
  return cmd;
}

export function buildBotCheckoutCommand(input: BuildInput): AgentCommand {
  const cmd = baseCommand(input);
  cmd.strategy = {
    attempt_pattern: "automated_checkout_flood",
    headless_browser: true,
    inventory_hold: true,
    velocity: "high",
  };
  return cmd;
}

export function buildAdminEndpointProbingCommand(
  input: BuildInput
): AgentCommand {
  const cmd = baseCommand(input);
  cmd.strategy = {
    attempt_pattern: "endpoint_discovery",
    probe_admin_routes: true,
    expect_status: [401, 403],
  };
  return cmd;
}

export function buildCredentialStuffingCommand(
  input: BuildInput
): AgentCommand {
  const cmd = baseCommand(input);
  cmd.strategy = {
    attempt_pattern: "high_volume_login",
    rotate_source_ips: true,
    use_dummy_combo_list: true,
    velocity: "high",
  };
  return cmd;
}

export function buildWebExploitCommand(input: BuildInput): AgentCommand {
  const cmd = baseCommand(input);
  cmd.strategy = {
    attempt_pattern: "injection_probes",
    payload_families: ["sqli", "xss", "path_traversal"],
    expect_waf_block: true,
  };
  return cmd;
}

export function buildGenericSimulationCommand(input: BuildInput): AgentCommand {
  const cmd = baseCommand(input);
  cmd.strategy = {
    attempt_pattern: "generic_safe_probe",
    signals: input.vector.simulated_signals,
  };
  return cmd;
}

/** Dispatch table — vector_id → builder. Falls back to generic. */
const BUILDERS: Record<string, (input: BuildInput) => AgentCommand> = {
  card_cracking: buildCardCrackingCommand,
  account_takeover: buildAccountTakeoverCommand,
  promo_abuse: buildPromoAbuseCommand,
  bot_checkout: buildBotCheckoutCommand,
  admin_endpoint_probing: buildAdminEndpointProbingCommand,
  credential_stuffing: buildCredentialStuffingCommand,
  web_exploit: buildWebExploitCommand,
};

/** Build the AgentCommand for any vector, using a specific builder if present. */
export function buildAgentCommand(input: BuildInput): AgentCommand {
  const builder = BUILDERS[input.vector.id] ?? buildGenericSimulationCommand;
  return builder(input);
}

/* --------------------------- mock event builder ------------------------- */

import type { DetectionEvent } from "./detectionEvent.types";

/**
 * Synthesize a SAFE mock DetectionEvent from a command (mock-mode launch). The
 * event_type uses the vector's mapped attack_type when present so the classifier
 * resolves it correctly, else the vector id.
 */
export function buildMockDetectionEventFromCommand(
  command: AgentCommand,
  vector: SimulationVector
): DetectionEvent {
  const ts = new Date().toISOString();
  const eventType = vector.default_attack_type ?? vector.id;
  // Deterministic-ish demo IP from the run id so repeats group sensibly.
  const ipTail =
    Math.abs(
      [...command.run_id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xff, 0)
    ) % 254;

  return {
    event_id: `EVT-${command.run_id}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: ts,
    source: "external_agent",
    mode: "simulation",
    event_type: eventType,
    domain_hint: vector.domain === "fraud" ? "fraud" : "attack",
    actor: {
      actor_name: `${vector.name} (mock agent)`,
      source_ip: `198.51.100.${ipTail + 1}`,
      user_agent: `${command.agent_id}/1.0 (mock)`,
      device_id: `device_${command.run_id.slice(-6).toLowerCase()}`,
    },
    target: {
      endpoint: command.target.endpoint ?? command.target.base_url,
      resource: command.target.target_type,
      method: "POST",
      asset: command.target.target_type,
    },
    evidence: vector.simulated_signals.slice(0, 3).map((sig) => ({
      timestamp: ts,
      type: vector.domain === "fraud" ? ("transaction" as const) : ("request" as const),
      summary: `Simulated signal: ${sig.replace(/_/g, " ")}.`,
    })),
    raw: { mock: true, command_preview: command },
  };
}
