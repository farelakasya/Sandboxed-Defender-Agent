/**
 * Unified Detection Event types for the Sandboxed Defender platform.
 *
 * Every event — fraud simulation, attack simulation, Lambda/Bedrock scan,
 * production log — normalizes into a DetectionEvent, then flows through:
 *   classify → analyze → mitigate → notify → recommend → SecurityTicket
 *
 * Multi-label classification is first-class:
 *   - An event can be attack + fraud + anomaly simultaneously.
 *   - e.g. credential stuffing → account takeover → suspicious export
 *     = primary_type: "fraud", secondary_types: ["attack", "anomaly"]
 */

// ---------------------------------------------------------------------------
// Core enums
// ---------------------------------------------------------------------------

export type DetectionType = "normal" | "anomaly" | "attack" | "fraud";

export type DetectionEventSource =
  | "simulation"         // In-app red/blue sim
  | "fraud_simulation"   // Fraud sim page
  | "redteam_simulation" // Bedrock attack API
  | "lambda"             // Lambda Claude scan
  | "external_agent"     // Collaborator backend / Bedrock agent callback
  | "api_logs"           // Backend log analysis
  | "transaction_logs"   // Payment/transaction analysis
  | "manual"             // Manual entry
  | "production";        // Future production events

export type DetectionMode = "simulation" | "production";

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  timestamp: string;
  type: "log" | "observation" | "request" | "transaction" | "export" | "other";
  summary: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// DetectionEvent — the canonical input to the pipeline
// ---------------------------------------------------------------------------

export interface DetectionEvent {
  event_id: string;
  created_at: string;
  source: DetectionEventSource;
  mode: DetectionMode;

  /** Slug key for the event type, e.g. "card_cracking", "admin_endpoint_probing" */
  event_type: string;

  /** Optional hint from the producer about what domain this belongs to.
   *  The classifier may override this. */
  domain_hint?: DetectionType;

  actor: {
    user_id?: string;
    actor_name?: string;
    actor_role?: string;
    department?: string;
    source_ip?: string;
    user_agent?: string;
    device_id?: string;
    location?: string;
  };

  target: {
    endpoint?: string;
    resource?: string;
    method?: string;
    asset?: string;
  };

  evidence: EvidenceItem[];

  /** Raw upstream data preserved for debugging. */
  raw?: unknown;
}

// ---------------------------------------------------------------------------
// Classification — supports multi-label
// ---------------------------------------------------------------------------

export interface DetectionClassification {
  primary_type: DetectionType;
  secondary_types: DetectionType[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Mitigation
// ---------------------------------------------------------------------------

export type MitigationActionType =
  | "block_ip"
  | "rate_limit_ip"
  | "flag_user"
  | "disable_account"
  | "suspend_export"
  | "notify_dev"
  | "notify_admin"
  | "none";

export interface MitigationAction {
  action: MitigationActionType;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Developer notification
// ---------------------------------------------------------------------------

export interface DeveloperNotification {
  status: "sent" | "pending" | "failed" | "not_required";
  channel: "email" | "slack" | "dashboard" | "mock";
  recipient?: string;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Fix recommendation
// ---------------------------------------------------------------------------

export interface FixRecommendation {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  why_it_matters: string;
  suggested_fix: string;
  status: "todo" | "in_progress" | "done";
}

// ---------------------------------------------------------------------------
// Analysis result (output of the analyzer stage)
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  summary: string;
  classification: DetectionClassification;
  recommended_fixes: FixRecommendation[];
  mitigation_actions: MitigationAction[];
  developer_notification: DeveloperNotification;
}

// ---------------------------------------------------------------------------
// Human-readable labels
// ---------------------------------------------------------------------------

export function formatDetectionTypes(classification: DetectionClassification): string {
  const all = [classification.primary_type, ...classification.secondary_types];
  return all.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" + ");
}

export function detectionTypeColor(type: DetectionType): string {
  switch (type) {
    case "attack":  return "text-red-400";
    case "fraud":   return "text-amber-400";
    case "anomaly": return "text-violet-400";
    case "normal":
    default:        return "text-emerald-400";
  }
}

export function detectionTypeBadge(type: DetectionType): string {
  switch (type) {
    case "attack":  return "bg-red-500/15 text-red-400 border-red-500/30";
    case "fraud":   return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "anomaly": return "bg-violet-500/15 text-violet-400 border-violet-500/30";
    case "normal":
    default:        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  }
}
