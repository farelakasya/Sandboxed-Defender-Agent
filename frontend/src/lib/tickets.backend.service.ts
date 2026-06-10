import { apiGet, apiPatch } from "./api-client";
import type {
  ActorType,
  AutomatedMeasure,
  DefenderAction,
  EvidenceLog,
  Priority,
  RecommendedAction,
  SecurityTicket,
  Severity,
  TicketActivityItem,
  TicketStatus,
  TimelineEvent,
} from "./ticket.types";

type BackendTicketListResponse =
  | SecurityTicket[]
  | {
      tickets?: unknown[];
      total?: number;
      limit?: number;
      offset?: number;
    };

export type BackendTicketPage = {
  tickets: SecurityTicket[];
  total?: number;
  limit: number;
  offset: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asArray<T>(
  value: unknown,
  normalize: (item: unknown, index: number) => T
): T[] {
  return Array.isArray(value) ? value.map(normalize) : [];
}

function normalizeSeverity(value: unknown): Severity {
  const v = String(value ?? "").toUpperCase();
  if (v === "CRITICAL" || v === "HIGH" || v === "MEDIUM" || v === "LOW") {
    return v;
  }
  return "LOW";
}

function priorityFromRisk(score: number): Priority {
  if (score >= 90) return "P1";
  if (score >= 70) return "P2";
  if (score >= 40) return "P3";
  return "P4";
}

function normalizePriority(value: unknown, riskScore: number): Priority {
  const v = String(value ?? "").toUpperCase();
  if (v === "P1" || v === "P2" || v === "P3" || v === "P4") return v;
  return priorityFromRisk(asNumber(value, riskScore));
}

function normalizeStatus(value: unknown): TicketStatus {
  const v = String(value ?? "").toLowerCase();
  if (
    v === "new" ||
    v === "auto_contained" ||
    v === "needs_review" ||
    v === "investigating" ||
    v === "escalated" ||
    v === "resolved" ||
    v === "false_positive"
  ) {
    return v;
  }
  if (v === "contained" || v === "blocked") return "auto_contained";
  if (v === "dismissed" || v === "completed") return "false_positive";
  if (v === "ongoing" || v === "open") return "needs_review";
  return "new";
}

function normalizeActorType(value: unknown): ActorType {
  const v = String(value ?? "").toLowerCase();
  if (v === "external" || v === "internal" || v === "stale_account") return v;
  return "unknown";
}

function normalizeDefenderAction(value: unknown): DefenderAction {
  const v = String(value ?? "").toLowerCase();
  if (
    v === "block_ip" ||
    v === "rate_limit_ip" ||
    v === "flag_user" ||
    v === "notify_admin" ||
    v === "notify_dev" ||
    v === "disable_account" ||
    v === "suspend_export" ||
    v === "none"
  ) {
    return v;
  }
  return "none";
}

function normalizeActionPriority(value: unknown): RecommendedAction["priority"] {
  const v = String(value ?? "").toUpperCase();
  if (v === "HIGH" || v === "MEDIUM" || v === "LOW") return v;
  return "LOW";
}

function normalizeActionStatus(value: unknown): RecommendedAction["status"] {
  const v = String(value ?? "").toLowerCase();
  if (v === "todo" || v === "in_progress" || v === "done") return v;
  if (v === "completed" || v === "complete") return "done";
  if (v === "pending") return "todo";
  return "todo";
}

function normalizeMethod(value: unknown): EvidenceLog["method"] {
  const v = String(value ?? "").toUpperCase();
  if (v === "GET" || v === "POST" || v === "PUT" || v === "PATCH" || v === "DELETE") {
    return v;
  }
  return "GET";
}

function normalizeSource(value: unknown): SecurityTicket["source"] {
  const v = String(value ?? "").toLowerCase();
  if (
    v === "log" ||
    v === "pentagi" ||
    v === "combined" ||
    v === "lambda" ||
    v === "fraud_sim" ||
    v === "simulation"
  ) {
    return v;
  }
  return "combined";
}

function normalizeMeasure(item: unknown, index: number): AutomatedMeasure {
  const raw = asRecord(item);
  return {
    id: asString(raw.id, `measure-${index}`),
    name: asString(raw.name, "Automated measure"),
    status:
      raw.status === "pending" || raw.status === "failed" ? raw.status : "completed",
    timestamp: asString(raw.timestamp, new Date().toISOString()),
    description: asString(raw.description, ""),
  };
}

function normalizeEvidence(item: unknown, index: number): EvidenceLog {
  const raw = asRecord(item);
  return {
    id: asString(raw.id, `evidence-${index}`),
    timestamp: asString(raw.timestamp, new Date().toISOString()),
    method: normalizeMethod(raw.method),
    endpoint: asString(raw.endpoint, "/"),
    status_code: asNumber(raw.status_code, 0),
    ip: asString(raw.ip, "unknown"),
    user_agent: asString(raw.user_agent, "unknown"),
    reason: asString(raw.reason, "Detection evidence"),
  };
}

function normalizeTimeline(item: unknown, index: number): TimelineEvent {
  const raw = asRecord(item);
  return {
    id: asString(raw.id, `timeline-${index}`),
    timestamp: asString(raw.timestamp, new Date().toISOString()),
    event: asString(raw.event, "detection"),
    description: asString(raw.description, ""),
  };
}

function normalizeAction(item: unknown, index: number): RecommendedAction {
  const raw = asRecord(item);
  return {
    id: asString(raw.id, `action-${index}`),
    priority: normalizeActionPriority(raw.priority),
    title: asString(raw.title, "Review detection"),
    category: "Monitoring",
    why_it_matters: asString(raw.why_it_matters, "This verdict may require follow-up."),
    suggested_fix: asString(raw.suggested_fix, "Review the event context and tune controls if needed."),
    status: normalizeActionStatus(raw.status),
  };
}

function normalizeActivity(item: unknown, index: number): TicketActivityItem {
  const raw = asRecord(item);
  const actor = raw.actor;
  return {
    id: asString(raw.id, `activity-${index}`),
    timestamp: asString(raw.timestamp, new Date().toISOString()),
    actor:
      actor === "AI Defender" ||
      actor === "System" ||
      actor === "Developer" ||
      actor === "Admin"
        ? actor
        : "System",
    message: asString(raw.message, "Ticket activity recorded."),
  };
}

export function normalizeBackendTicketToSecurityTicket(rawTicket: unknown): SecurityTicket {
  const raw = asRecord(rawTicket);
  const now = new Date().toISOString();
  const ticketId = asString(raw.ticket_id ?? raw.id, "UNKNOWN-TICKET");
  const riskScore = asNumber(raw.risk_score, Math.round(asNumber(raw.confidence, 0) * 100));
  const sourceIp = asString(raw.source_ip, "");
  const endpoint = asString(raw.affected_endpoint, "/");
  const createdAt = asString(raw.created_at, now);
  const updatedAt = asString(raw.updated_at, createdAt);

  return {
    ticket_id: ticketId,
    title: asString(raw.title, "Detection ticket"),
    severity: normalizeSeverity(raw.severity),
    priority: normalizePriority(raw.priority, riskScore),
    risk_score: riskScore,
    status: normalizeStatus(raw.status),
    created_at: createdAt,
    updated_at: updatedAt,
    first_seen: asString(raw.first_seen, createdAt),
    last_seen: asString(raw.last_seen, updatedAt),
    attack_type: asString(
      raw.attack_type ?? raw.classification ?? raw.reason,
      "unknown_anomaly"
    ),
    threat_category: asString(raw.threat_category, "anomaly"),
    confidence: asNumber(raw.confidence, 0),
    affected_endpoint: endpoint,
    source: normalizeSource(raw.source),
    source_ip: sourceIp || undefined,
    actor_type: normalizeActorType(raw.actor_type),
    user_id: asString(raw.user_id ?? raw.user_identity, "") || undefined,
    user_agent: asString(raw.user_agent, "unknown"),
    matched_pattern: asString(raw.matched_pattern, "") || undefined,
    request_count: asNumber(raw.request_count, 1),
    detected_by: asString(raw.detected_by, "backend"),
    detection_source: asString(raw.detection_source, "backend verdicts"),
    automated_measures: asArray(raw.automated_measures, normalizeMeasure),
    evidence_logs: asArray(raw.evidence_logs, normalizeEvidence),
    recommended_actions: asArray(raw.recommended_actions, normalizeAction),
    ai_analysis: asString(raw.ai_analysis, "Backend verdict loaded."),
    timeline: asArray(raw.timeline, normalizeTimeline),
    activity: asArray(raw.activity, normalizeActivity),
    defender_action: normalizeDefenderAction(raw.defender_action),
    action_taken: asBoolean(raw.action_taken, false),
    assigned_team: asString(raw.assigned_team, "") || undefined,
    sla_due_at: asString(raw.sla_due_at, "") || undefined,
    is_grouped: asBoolean(raw.is_grouped, false),
    grouped_event_count: asNumber(raw.grouped_event_count, 0) || undefined,
    suppressed_event_count: asNumber(raw.suppressed_event_count, 0) || undefined,
    containment_status:
      raw.containment_status === "contained" ||
      raw.containment_status === "partial" ||
      raw.containment_status === "not_contained" ||
      raw.containment_status === "pending"
        ? raw.containment_status
        : undefined,
    mitigation_actions: [],
    recommended_fixes: [],
  };
}

export function getBackendHealth(): Promise<{ status: string }> {
  return apiGet<{ status: string }>("/health");
}

export async function getTicketsFromBackend(
  params: { limit?: number; offset?: number } = {}
): Promise<SecurityTicket[]> {
  return (await getTicketPageFromBackend(params)).tickets;
}

export async function getTicketPageFromBackend(
  params: { limit?: number; offset?: number } = {}
): Promise<BackendTicketPage> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const data = await apiGet<BackendTicketListResponse>(
    `/api/tickets?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`
  );
  const rawTickets = Array.isArray(data) ? data : data.tickets ?? [];
  return {
    tickets: rawTickets.map(normalizeBackendTicketToSecurityTicket),
    total: Array.isArray(data) ? undefined : data.total,
    limit: Array.isArray(data) ? limit : data.limit ?? limit,
    offset: Array.isArray(data) ? offset : data.offset ?? offset,
  };
}

export async function getTicketFromBackend(
  ticketId: string
): Promise<SecurityTicket | null> {
  try {
    const data = await apiGet<unknown>(`/api/tickets/${encodeURIComponent(ticketId)}`);
    return normalizeBackendTicketToSecurityTicket(data);
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 404) return null;
    throw err;
  }
}

export async function updateTicketStatusOnBackend(
  ticketId: string,
  status: string
): Promise<SecurityTicket> {
  const data = await apiPatch<unknown>(
    `/api/tickets/${encodeURIComponent(ticketId)}/status`,
    { status }
  );
  return normalizeBackendTicketToSecurityTicket(data);
}
