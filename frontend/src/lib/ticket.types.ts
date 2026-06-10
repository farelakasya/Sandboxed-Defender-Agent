/**
 * Canonical ticket domain types for the Security Ticket Queue + Detail module.
 *
 * Extended with optional unified detection fields so fraud simulations,
 * attack simulations, Lambda/Bedrock findings, and production events all
 * share the same SecurityTicket shape. Existing fields are unchanged;
 * detection fields are optional and backward-compatible.
 */

import type {
  DetectionClassification,
  DetectionMode,
  DeveloperNotification,
  FixRecommendation,
  MitigationAction,
} from "./detectionEvent.types";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TicketStatus =
  | "new"
  | "auto_contained"
  | "needs_review"
  | "investigating"
  | "escalated"
  | "resolved"
  | "false_positive";

export type Priority = "P1" | "P2" | "P3" | "P4";

export type ActorType = "external" | "internal" | "stale_account" | "unknown";

export type DefenderAction =
  | "block_ip"
  | "rate_limit_ip"
  | "flag_user"
  | "notify_admin"
  | "notify_dev"
  | "disable_account"
  | "suspend_export"
  | "none";

export type AutomatedMeasure = {
  id: string;
  name: string;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  description: string;
};

export type EvidenceLog = {
  id: string;
  timestamp: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  status_code: number;
  ip: string;
  user_agent: string;
  reason: string;
};

export type RecommendedActionCategory =
  | "Authentication & Authorization"
  | "Rate Limiting"
  | "Audit Logging"
  | "Access Control"
  | "Monitoring"
  | "Account Security";

export type RecommendedAction = {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  category: RecommendedActionCategory;
  why_it_matters: string;
  suggested_fix: string;
  status: "todo" | "in_progress" | "done";
};

export type TimelineEvent = {
  id: string;
  timestamp: string;
  event: string;
  description: string;
};

export type TicketActivityActor =
  | "AI Defender"
  | "System"
  | "Developer"
  | "Admin";

export type TicketActivityItem = {
  id: string;
  timestamp: string;
  actor: TicketActivityActor;
  message: string;
};

export type SecurityTicket = {
  ticket_id: string;
  title: string;
  severity: Severity;
  priority: Priority;
  risk_score: number;
  status: TicketStatus;

  created_at: string;
  updated_at: string;
  first_seen: string;
  last_seen: string;

  attack_type: string;
  threat_category: string;
  confidence: number;

  affected_endpoint: string;
  source: "log" | "pentagi" | "combined" | "lambda" | "fraud_sim" | "simulation";
  source_ip?: string;
  actor_type: ActorType;
  user_id?: string;
  user_agent?: string;
  matched_pattern?: string;

  request_count: number;
  detected_by: string;
  detection_source: string;

  automated_measures: AutomatedMeasure[];
  evidence_logs: EvidenceLog[];
  recommended_actions: RecommendedAction[];
  ai_analysis: string;
  timeline: TimelineEvent[];
  activity: TicketActivityItem[];

  defender_action: DefenderAction;
  action_taken: boolean;

  assigned_team?: string;
  sla_due_at?: string;

  is_grouped: boolean;
  grouped_event_count?: number;
  suppressed_event_count?: number;

  // === Unified detection fields (optional, backward-compatible) ===

  /** Multi-label detection classification (anomaly/attack/fraud combos). */
  detection_classification?: DetectionClassification;
  /** Mitigation actions taken by the system. */
  mitigation_actions?: MitigationAction[];
  /** Overall containment status. */
  containment_status?: "contained" | "partial" | "not_contained" | "pending";
  /** Developer notification status. */
  developer_notification?: DeveloperNotification;
  /** Structured fix recommendations from the analyzer. */
  recommended_fixes?: FixRecommendation[];
  /** AI/rule-based analyzer narrative. */
  analyzer_summary?: string;
  /** Whether this ticket originated from simulation or production. */
  detection_mode?: DetectionMode;
};

/** Aggregate metrics surfaced in the queue KPI cards. */
export type QueueMetrics = {
  total: number;
  open: number;
  criticalHigh: number;
  autoContained: number;
  needsReview: number;
  blockedIps: number;
  suppressedEvents: number;
  resolved: number;
  grouped: number;
};

/** Tab identifiers for the queue view. */
export type QueueTab =
  | "all"
  | "p1_critical"
  | "needs_review"
  | "auto_contained"
  | "grouped"
  | "resolved"
  | "suppressed";
