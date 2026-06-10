import type {
  AutomatedMeasure,
  EvidenceLog,
  RecommendedAction,
  SecurityTicket,
  Severity,
  TicketStatus,
  TimelineEvent,
} from "./ticket.types";
import type { SimulationIncidentEvent } from "./redteam.types";
import { getPriorityFromRiskScore } from "./ticket.utils";
import { THREAT_CATEGORY } from "./redteam-classifier";

/**
 * Adapter: Bedrock red-team SimulationIncidentEvent → SecurityTicket.
 *
 * This is the Bedrock pipeline's analogue of simulation-to-ticket.adapter.ts
 * (which serves the in-app red/blue simulator). The two are kept separate
 * because they consume different event shapes. Pure module — the store owns
 * persistence and dedup.
 *
 * TODO(api): when the backend owns normalization, this stays as the client-side
 * contract reference.
 */

const RISK_SCORE: Record<Severity, number> = {
  LOW: 25,
  MEDIUM: 68,
  HIGH: 110,
  CRITICAL: 150,
};

const VALID_METHODS: EvidenceLog["method"][] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

function coerceMethod(method: string): EvidenceLog["method"] {
  const upper = method.toUpperCase() as EvidenceLog["method"];
  return VALID_METHODS.includes(upper) ? upper : "GET";
}

/** Stable, derived ticket id so the same event never creates two tickets. */
export function ticketIdForEvent(event: SimulationIncidentEvent): string {
  return `INC-RT-${event.event_id}`;
}

/** Coerce red-team evidence logs to the ticket EvidenceLog shape. */
export function toEvidenceLogs(event: SimulationIncidentEvent): EvidenceLog[] {
  return event.evidence_logs.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    method: coerceMethod(e.method),
    endpoint: e.endpoint,
    status_code: e.status_code,
    ip: e.ip,
    user_agent: e.user_agent,
    reason: e.reason,
  }));
}

/** Recommended actions are structurally compatible; pass through. */
function toRecommendedActions(
  event: SimulationIncidentEvent
): RecommendedAction[] {
  return event.recommended_actions.map((r) => ({ ...r }));
}

/** Defender measures map 1:1 to AutomatedMeasure. */
function toAutomatedMeasures(
  event: SimulationIncidentEvent
): AutomatedMeasure[] {
  return event.defender.measures.map((m) => ({ ...m }));
}

function buildTimeline(event: SimulationIncidentEvent): TimelineEvent[] {
  const ts = event.created_at;
  const first = event.evidence_logs[0];
  const timeline: TimelineEvent[] = [
    {
      id: `${event.event_id}-t1`,
      timestamp: first?.timestamp ?? ts,
      event: "Attack request received",
      description: first
        ? `${first.method} ${first.endpoint} from ${first.ip} → ${first.status_code}.`
        : `${event.target.method} ${event.target.endpoint}.`,
    },
    {
      id: `${event.event_id}-t2`,
      timestamp: ts,
      event: "Threat classified",
      description: `Classified as ${event.attack_type}, ${event.severity} severity.`,
    },
  ];
  if (event.defender.action !== "none") {
    timeline.push({
      id: `${event.event_id}-t3`,
      timestamp: ts,
      event: event.defender.action_taken
        ? "Automated response executed"
        : "Response recommended",
      description: `Defender action "${event.defender.action}" (${
        event.defender.action_taken ? "taken" : "pending review"
      }).`,
    });
  }
  return timeline;
}

/**
 * normalizeSimulationEventToTicket — build a SecurityTicket from a Bedrock
 * red-team event. Uses a STABLE derived ticket_id so re-importing the same event
 * is idempotent.
 */
export function normalizeRedTeamEventToTicket(
  event: SimulationIncidentEvent
): SecurityTicket {
  const severity = event.severity;
  const risk = RISK_SCORE[severity];
  const evidence = toEvidenceLogs(event);
  const ts = event.created_at;

  const status: TicketStatus = event.defender.action_taken
    ? "auto_contained"
    : "needs_review";

  return {
    ticket_id: ticketIdForEvent(event),
    title: event.title,
    severity,
    priority: getPriorityFromRiskScore(risk),
    risk_score: risk,
    status,
    created_at: ts,
    updated_at: ts,
    first_seen: ts,
    last_seen: ts,
    attack_type: event.attack_type,
    threat_category: THREAT_CATEGORY[event.attack_type] ?? "Security Event",
    confidence: event.confidence,
    affected_endpoint: event.target.endpoint,
    // "combined" — produced by the Bedrock attacker + AI defender pipeline.
    source: "combined",
    source_ip: event.attacker.source_ip,
    actor_type: event.attacker.actor_type,
    user_id: event.attacker.user_id,
    user_agent: event.attacker.user_agent,
    matched_pattern: event.attacker.persona_name,
    request_count: evidence.length || 1,
    detected_by: "AI Defender Agent",
    detection_source: "Bedrock Red-Team Simulation",
    defender_action: event.defender.action,
    action_taken: event.defender.action_taken,
    assigned_team: "Platform Security",
    sla_due_at: new Date(
      new Date(ts).getTime() + 4 * 3600_000
    ).toISOString(),
    is_grouped: false,
    automated_measures: toAutomatedMeasures(event),
    evidence_logs: evidence,
    recommended_actions: toRecommendedActions(event),
    ai_analysis: event.ai_analysis,
    timeline: buildTimeline(event),
    activity: [
      {
        id: `${event.event_id}-a1`,
        timestamp: ts,
        actor: "AI Defender",
        message: "Ticket created from Bedrock red-team attack.",
      },
    ],
  };
}

/** Dedup key for grouping repeat red-team activity onto one open ticket. */
export function redTeamDedupKey(event: SimulationIncidentEvent): string {
  return `${event.attack_type}::${event.target.endpoint}::${
    event.attacker.source_ip ?? ""
  }`;
}

/** Same dedup key, computed from an existing ticket. */
export function redTeamDedupKeyForTicket(ticket: SecurityTicket): string {
  return `${ticket.attack_type}::${ticket.affected_endpoint}::${
    ticket.source_ip ?? ""
  }`;
}
