/**
 * Shared red-team / Bedrock simulation types.
 *
 * These describe the contract between the Bedrock attacker agent (running
 * remotely) and this app's safe, simulated red-team API. They are intentionally
 * kept SEPARATE from src/lib/simulation.types.ts, which powers the in-app
 * /simulations/red-blue visual simulator and has its own (simpler) event shape.
 * Do not merge the two — the in-app simulator and this Bedrock pipeline are two
 * independent producers of tickets.
 *
 * SAFETY: every event here is simulated. No real exploitation, no real
 * firewall blocking, no real credentials, no production systems.
 *
 * TODO(api): the SimulationIncidentEvent below is the canonical hand-off shape;
 * it currently lives in an in-memory store (see redteam-event-store.ts). Replace
 * that store with a durable queue/DB for production.
 */

/** Actor classification for an attacker. */
export type ActorType = "external" | "internal" | "stale_account" | "unknown";

/** Catalogue of attack types the simulation understands. */
export type AttackType =
  | "admin_endpoint_probing"
  | "credential_stuffing"
  | "report_export_abuse"
  | "stale_account_abuse"
  | "insider_data_access"
  | "network_recon"
  | "dns_spoofing"
  | "smtp_relay_abuse"
  | "firewall_bypass"
  | "web_exploit";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Inbound request the Bedrock attacker agent sends to POST /api/redteam/attack,
 * or that a dummy target route synthesizes for itself before classification.
 */
export type SimulationAttackRequest = {
  run_id: string;
  attack_id?: string;
  attack_type: AttackType;
  attacker: {
    persona_name?: string;
    actor_type: ActorType;
    source_ip?: string;
    user_id?: string;
    user_agent?: string;
  };
  target: {
    method: HttpMethod;
    endpoint: string;
    asset?: string;
  };
  metadata?: {
    confidence?: number;
    notes?: string;
  };
};

export type DefenderActionId =
  | "block_ip"
  | "rate_limit_ip"
  | "flag_user"
  | "notify_admin"
  | "notify_dev"
  | "none";

export type DefenderMeasure = {
  id: string;
  name: string;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  description: string;
};

export type RedTeamEvidenceLog = {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status_code: number;
  ip: string;
  user_agent: string;
  reason: string;
};

export type RedTeamRecommendedAction = {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category:
    | "Authentication & Authorization"
    | "Rate Limiting"
    | "Audit Logging"
    | "Access Control"
    | "Monitoring"
    | "Account Security";
  title: string;
  why_it_matters: string;
  suggested_fix: string;
  status: "todo" | "in_progress" | "done";
};

/**
 * The classified, structured incident produced from a SimulationAttackRequest.
 * This is what gets stored, polled by the client, and normalized into a ticket.
 */
export type SimulationIncidentEvent = {
  event_id: string;
  run_id: string;
  created_at: string;
  attack_type: AttackType;
  severity: Severity;
  confidence: number;
  title: string;
  source: "bedrock" | "simulation" | "combined";
  attacker: {
    persona_name?: string;
    actor_type: ActorType;
    source_ip?: string;
    user_id?: string;
    user_agent?: string;
  };
  target: {
    method: string;
    endpoint: string;
    asset?: string;
  };
  defender: {
    action_taken: boolean;
    action: DefenderActionId;
    measures: DefenderMeasure[];
  };
  evidence_logs: RedTeamEvidenceLog[];
  recommended_actions: RedTeamRecommendedAction[];
  ai_analysis: string;
};

/** Standard envelope returned by POST /api/redteam/attack and dummy targets. */
export type RedTeamAttackResponse = {
  ok: boolean;
  simulated: true;
  event: SimulationIncidentEvent;
  message: string;
};
