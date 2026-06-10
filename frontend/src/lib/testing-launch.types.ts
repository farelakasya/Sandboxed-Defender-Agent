/**
 * Unified simulation launch model.
 *
 * The frontend sends a SimulationLaunchRequest (vector_id + target + options) to
 * our own POST /api/testing/launch. The backend looks up the vector, picks the
 * agent, builds an AgentCommand, and either returns a mock result or forwards
 * the command to the collaborator backend. The browser NEVER talks to AWS /
 * Bedrock / the collaborator backend directly.
 */

export type SimulationDomain = "attack" | "fraud";

export type SimulationMode = "mock" | "external";

export type DetectionLabel = "anomaly" | "attack" | "fraud";

export type SimulationTargetType =
  | "auth_service"
  | "checkout_api"
  | "payment_gateway"
  | "admin_api"
  | "reports_api"
  | "client_data_api"
  | "generic_api";

export type SimulationVector = {
  id: string;
  name: string;
  domain: SimulationDomain;
  description?: string;
  category?: string;
  mapped_standards?: string[];
  default_agent_id: string;
  supported_agent_ids?: string[];
  default_attack_type?: string;
  expected_detection_labels: DetectionLabel[];
  target_types: string[];
  simulated_signals: string[];
  recommended_mitigations: string[];
  safe_constraints: {
    safe_mode: boolean;
    no_real_credentials?: boolean;
    no_real_payment?: boolean;
    allowed_targets_only?: boolean;
    max_attempts?: number;
    max_steps?: number;
  };
};

export type SimulationTarget = {
  id?: string;
  name?: string;
  base_url: string;
  endpoint?: string;
  target_type: SimulationTargetType;
  environment: "local" | "demo" | "staging";
};

export type SimulationLaunchRequest = {
  domain: SimulationDomain;
  vector_id: string;
  target: SimulationTarget;
  options?: {
    safe_mode?: boolean;
    max_steps?: number;
    max_attempts?: number;
    agents?: number;
  };
};

export type AgentProvider = "mock" | "lambda" | "bedrock" | "collaborator_api";

export type AgentCommand = {
  run_id: string;
  domain: SimulationDomain;
  agent_id: string;
  task: string;
  vector_id: string;
  vector_name: string;
  target: SimulationTarget;
  strategy: Record<string, unknown>;
  constraints: {
    safe_mode: boolean;
    max_steps: number;
    max_attempts?: number;
    no_real_credentials: boolean;
    no_real_payment?: boolean;
    allowed_targets_only: boolean;
  };
  callback: {
    event_url: string;
    result_url?: string;
  };
  expected_detection_labels: DetectionLabel[];
};

export type SimulationLaunchResponse = {
  ok: boolean;
  run_id?: string;
  status: "queued" | "running" | "completed" | "failed";
  provider: AgentProvider;
  message: string;
  command_preview?: AgentCommand;
  result?: unknown;
  error?: string;
};
