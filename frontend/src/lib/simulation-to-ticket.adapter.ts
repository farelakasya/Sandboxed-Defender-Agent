/**
 * Legacy adapter: in-app Red/Blue sim events → SecurityTicket (used by the
 * Zustand store's upsertTicketFromSimulation, mock/demo path only).
 *
 * CANONICAL path for new work is the unified detection-pipeline.ts
 * (DetectionEvent → classify → analyze → ticket). Kept because the in-app
 * simulator still emits the older SimulationIncidentEvent shape.
 */
import {
  AutomatedMeasure,
  DefenderAction,
  EvidenceLog,
  RecommendedAction,
  RecommendedActionCategory,
  SecurityTicket,
  Severity,
  TicketStatus,
  TimelineEvent,
} from "./ticket.types";
import {
  SimulationAttackKey,
  SimulationIncidentEvent,
  SimulationOutcome,
} from "./simulation.types";
import { getPriorityFromRiskScore } from "./ticket.utils";

/**
 * Adapter: turns a SimulationIncidentEvent into a SecurityTicket.
 *
 * The simulator never touches ticket components directly — it emits events,
 * this pure module normalizes them, and the ticket store persists them. That
 * keeps the simulator and the ticket UI fully decoupled.
 *
 * TODO(api): when the backend owns this, POST /api/tickets/from-simulation
 * should perform the same normalization server-side; keep this as the client
 * fallback / contract reference.
 */

/* ------------------------------- per-vector config ------------------------ */

const ATTACK_TYPE: Record<SimulationAttackKey, string> = {
  recon: "network_recon",
  dns: "dns_spoofing",
  mail: "smtp_relay_abuse",
  fw: "firewall_bypass",
  web: "web_exploit",
};

const THREAT_CATEGORY: Record<SimulationAttackKey, string> = {
  recon: "Reconnaissance",
  dns: "Network Spoofing",
  mail: "Mail Relay Abuse",
  fw: "Perimeter Evasion",
  web: "Web Application Attack",
};

/** Endpoint/asset most associated with each vector (used when the sim has none). */
const AFFECTED_ENDPOINT: Record<SimulationAttackKey, string> = {
  recon: "network topology (R1→R3→R2)",
  dns: "DNS resolver",
  mail: "SMTP relay",
  fw: "perimeter firewall (R3)",
  web: "/admin",
};

/** Severity per vector × outcome (per confirmed mapping). */
const SEVERITY: Record<SimulationAttackKey, Record<SimulationOutcome, Severity>> = {
  recon: { blocked: "LOW", breached: "MEDIUM" },
  dns: { blocked: "MEDIUM", breached: "HIGH" },
  mail: { blocked: "MEDIUM", breached: "HIGH" },
  fw: { blocked: "HIGH", breached: "CRITICAL" },
  web: { blocked: "HIGH", breached: "CRITICAL" },
};

/** Defender action when the attack was blocked (breached is handled below). */
const BLOCKED_DEFENDER_ACTION: Record<SimulationAttackKey, DefenderAction> = {
  recon: "rate_limit_ip",
  dns: "notify_admin",
  mail: "notify_admin",
  fw: "block_ip",
  web: "block_ip",
};

const RISK_SCORE: Record<Severity, number> = {
  LOW: 25,
  MEDIUM: 68,
  HIGH: 110,
  CRITICAL: 150,
};

/* --------------------------------- helpers -------------------------------- */

export interface SimTicketMapping {
  attack_type: string;
  severity: Severity;
  status: TicketStatus;
  affected_endpoint: string;
  defender_action: DefenderAction;
  action_taken: boolean;
}

/** Resolve the core mapping values for an event (exposed for upsert/dedup). */
export function resolveMapping(event: SimulationIncidentEvent): SimTicketMapping {
  const k = event.attack_key;
  const blocked = event.outcome === "blocked";
  return {
    attack_type: ATTACK_TYPE[k],
    severity: SEVERITY[k][event.outcome],
    // blocked -> auto_contained, breached -> needs_review
    status: blocked ? "auto_contained" : "needs_review",
    affected_endpoint: AFFECTED_ENDPOINT[k],
    // breached: always notify_admin, no action taken.
    defender_action: blocked ? BLOCKED_DEFENDER_ACTION[k] : "notify_admin",
    action_taken: blocked,
  };
}

/**
 * Internal dedup key — NOT the ticket id. Used to find an existing unresolved
 * ticket to update instead of creating a duplicate.
 */
export function dedupKey(
  attackType: string,
  endpoint: string,
  sourceIp: string
): string {
  return `${attackType}::${endpoint}::${sourceIp}`;
}

export function dedupKeyForEvent(event: SimulationIncidentEvent): string {
  const m = resolveMapping(event);
  return dedupKey(m.attack_type, m.affected_endpoint, event.source_ip);
}

export function dedupKeyForTicket(ticket: SecurityTicket): string {
  return dedupKey(
    ticket.attack_type,
    ticket.affected_endpoint,
    ticket.source_ip ?? ""
  );
}

/** HTTP-ish status code used in the synthesized evidence log. */
function evidenceStatusCode(outcome: SimulationOutcome): number {
  return outcome === "blocked" ? 403 : 200;
}

function evidenceMethod(key: SimulationAttackKey): EvidenceLog["method"] {
  return key === "web" || key === "mail" ? "POST" : "GET";
}

/** Strip simple HTML tags the simulator wraps around log messages. */
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

export function buildEvidenceLog(event: SimulationIncidentEvent): EvidenceLog {
  return {
    id: `${event.event_id}-e1`,
    timestamp: event.timestamp,
    method: evidenceMethod(event.attack_key),
    endpoint: AFFECTED_ENDPOINT[event.attack_key],
    status_code: evidenceStatusCode(event.outcome),
    ip: event.source_ip,
    user_agent: "red-team-sim/1.0",
    reason: `${event.attack_label} → ${event.target_node}: ${stripTags(
      event.red_message
    )}`,
  };
}

function buildAutomatedMeasures(
  event: SimulationIncidentEvent,
  mapping: SimTicketMapping
): AutomatedMeasure[] {
  const base: AutomatedMeasure[] = [
    {
      id: `${event.event_id}-m1`,
      name: "Threat classified",
      status: "completed",
      timestamp: event.timestamp,
      description: `Classified red-team activity as ${mapping.attack_type}.`,
    },
    {
      id: `${event.event_id}-m2`,
      name: "Severity assigned",
      status: "completed",
      timestamp: event.timestamp,
      description: `Assigned ${mapping.severity} severity (outcome: ${event.outcome}).`,
    },
  ];

  if (mapping.action_taken) {
    base.push({
      id: `${event.event_id}-m3`,
      name: `Defender action: ${mapping.defender_action}`,
      status: "completed",
      timestamp: event.timestamp,
      description: stripTags(event.blue_message),
    });
  } else {
    // breached — defender alerted but did not contain.
    base.push({
      id: `${event.event_id}-m3`,
      name: "Admin notified",
      status: "completed",
      timestamp: event.timestamp,
      description: `Partial breach on ${event.target_node}; ${stripTags(
        event.blue_message
      )}`,
    });
    base.push({
      id: `${event.event_id}-m4`,
      name: "Containment",
      status: "failed",
      timestamp: event.timestamp,
      description: "Automated containment did not stop the breach; manual review required.",
    });
  }

  return base;
}

/** Fallback recommendations keyed by attack vector. */
const RECOMMENDATIONS: Record<
  SimulationAttackKey,
  Array<Omit<RecommendedAction, "id" | "status">>
> = {
  recon: [
    {
      priority: "MEDIUM",
      title: "Reduce network reconnaissance surface",
      category: "Monitoring",
      why_it_matters: "Topology disclosure helps attackers plan lateral movement.",
      suggested_fix: "Limit ICMP/traceroute responses and alert on scan patterns.",
    },
  ],
  dns: [
    {
      priority: "HIGH",
      title: "Harden DNS against spoofing",
      category: "Access Control",
      why_it_matters: "DNS spoofing enables traffic redirection and MITM.",
      suggested_fix: "Enable DNSSEC and validate resolver responses.",
    },
  ],
  mail: [
    {
      priority: "HIGH",
      title: "Lock down SMTP relay",
      category: "Access Control",
      why_it_matters: "Open relays are abused for spoofing and spam.",
      suggested_fix: "Require authenticated submission and restrict relay hosts.",
    },
  ],
  fw: [
    {
      priority: "HIGH",
      title: "Review and tighten firewall rules",
      category: "Access Control",
      why_it_matters: "Perimeter evasion exposes internal services.",
      suggested_fix: "Audit R3 rule set; deny-by-default and log anomalies.",
    },
    {
      priority: "MEDIUM",
      title: "Rate limit perimeter probing",
      category: "Rate Limiting",
      why_it_matters: "Repeated bypass attempts should be throttled.",
      suggested_fix: "Apply connection rate limits on the edge firewall.",
    },
  ],
  web: [
    {
      priority: "HIGH",
      title: "Add WAF rules for the admin surface",
      category: "Authentication & Authorization",
      why_it_matters: "Web exploits target login/admin endpoints directly.",
      suggested_fix: "Deploy WAF rules and require auth on /admin.",
    },
    {
      priority: "MEDIUM",
      title: "Validate and sanitize inputs",
      category: "Authentication & Authorization",
      why_it_matters: "SQLi/brute-force thrive on weak input handling.",
      suggested_fix: "Parameterize queries and add login backoff/lockout.",
    },
  ],
};

function buildRecommendedActions(
  event: SimulationIncidentEvent
): RecommendedAction[] {
  return RECOMMENDATIONS[event.attack_key].map((r, i) => ({
    ...r,
    id: `${event.event_id}-r${i + 1}`,
    status: "todo" as const,
  }));
}

function buildAiAnalysis(
  event: SimulationIncidentEvent,
  mapping: SimTicketMapping
): string {
  const red = stripTags(event.red_message);
  const blue = stripTags(event.blue_message);
  if (event.outcome === "blocked") {
    return `The red team attempted ${event.attack_label.toLowerCase()} against ${event.target_node} (${red}). The blue team contained it (${blue}), so the defender executed "${mapping.defender_action}" and the incident is auto-contained. Recommended follow-up focuses on hardening ${mapping.affected_endpoint}.`;
  }
  return `The red team's ${event.attack_label.toLowerCase()} against ${event.target_node} resulted in a partial breach (${red}). The blue team detected but did not fully contain it (${blue}); admins were notified and the ticket needs review. Prioritize the recommended fixes for ${mapping.affected_endpoint}.`;
}

function buildTimeline(
  event: SimulationIncidentEvent,
  mapping: SimTicketMapping
): TimelineEvent[] {
  return [
    {
      id: `${event.event_id}-t1`,
      timestamp: event.timestamp,
      event: "Attack request received",
      description: `Red team: ${stripTags(event.red_message)} (target ${event.target_node}).`,
    },
    {
      id: `${event.event_id}-t2`,
      timestamp: event.timestamp,
      event: "Threat classified",
      description: `Classified as ${mapping.attack_type}, ${mapping.severity} severity.`,
    },
    {
      id: `${event.event_id}-t3`,
      timestamp: event.timestamp,
      event:
        event.outcome === "blocked"
          ? "Automated response executed"
          : "Breach detected",
      description:
        event.outcome === "blocked"
          ? `Defender action "${mapping.defender_action}": ${stripTags(event.blue_message)}.`
          : `Partial breach; admin notified: ${stripTags(event.blue_message)}.`,
    },
  ];
}

/* --------------------------------- main ----------------------------------- */

/**
 * normalizeSimulationEventToTicket — build a brand-new SecurityTicket from a
 * simulation event. The ticket_id is always unique (event-scoped); dedup is a
 * separate concern handled by the store's upsert via dedupKey*().
 */
export function normalizeSimulationEventToTicket(
  event: SimulationIncidentEvent
): SecurityTicket {
  const mapping = resolveMapping(event);
  const severity = mapping.severity;
  const risk = RISK_SCORE[severity];

  // Unique, human-readable id. NOT used for dedup.
  const ticketId = `INC-SIM-${event.run_id}-${event.event_id}`;

  return {
    ticket_id: ticketId,
    title: `${event.attack_label} on ${event.target_node}`,
    severity,
    priority: getPriorityFromRiskScore(risk),
    risk_score: risk,
    status: mapping.status,
    created_at: event.timestamp,
    updated_at: event.timestamp,
    first_seen: event.timestamp,
    last_seen: event.timestamp,
    attack_type: mapping.attack_type,
    threat_category: THREAT_CATEGORY[event.attack_key],
    confidence: event.outcome === "breached" ? 0.9 : 0.82,
    affected_endpoint: mapping.affected_endpoint,
    source: "pentagi",
    source_ip: event.source_ip,
    actor_type: "external",
    user_agent: "red-team-sim/1.0",
    matched_pattern: `Red Team — ${event.attack_label}`,
    request_count: 1,
    detected_by: "Red/Blue Simulator",
    detection_source: "In-app Attacker/Defender Simulation",
    defender_action: mapping.defender_action,
    action_taken: mapping.action_taken,
    assigned_team: "Platform Security",
    sla_due_at: new Date(
      new Date(event.timestamp).getTime() + 4 * 3600_000
    ).toISOString(),
    is_grouped: false,
    automated_measures: buildAutomatedMeasures(event, mapping),
    evidence_logs: [buildEvidenceLog(event)],
    recommended_actions: buildRecommendedActions(event),
    ai_analysis: buildAiAnalysis(event, mapping),
    timeline: buildTimeline(event, mapping),
    activity: [
      {
        id: `${event.event_id}-a1`,
        timestamp: event.timestamp,
        actor: "AI Defender",
        message: `Ticket created from simulation (${event.outcome}).`,
      },
    ],
  };
}
