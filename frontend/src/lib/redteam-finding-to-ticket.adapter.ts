/**
 * Adapter: AWS Lambda Claude red-team findings → SecurityTicket.
 *
 * The Lambda returns findings with LOWERCASE severities (including "info") and a
 * summary carrying only { total, critical }. This module normalizes a finding
 * into the app's real SecurityTicket shape so the existing queue / detail /
 * dashboard render it with zero UI changes.
 *
 * Pure module — the store owns persistence + dedup.
 */
import type {
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
import type {
  RedTeamFinding,
  RedTeamScanResponse,
  TicketSeverity,
} from "./redteam-scan.types";
import { getPriorityFromRiskScore } from "./ticket.utils";

export type ScanContext = {
  target: string;
  run_id?: string;
  attacker_id?: string;
  attacker_name?: string;
};

/* ------------------------------ severity ---------------------------------- */

/**
 * Normalize a wire severity (lowercase, may be "info") to the 5-value
 * TicketSeverity. Unknown / "info" → "INFO".
 */
export function normalizeSeverity(raw: string | undefined): TicketSeverity {
  switch ((raw ?? "").toLowerCase()) {
    case "critical":
      return "CRITICAL";
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    case "low":
      return "LOW";
    default:
      return "INFO"; // covers "info" and anything unexpected
  }
}

/**
 * The ticket domain Severity has no "INFO" — collapse INFO onto LOW so we never
 * produce an invalid ticket. (INFO findings are usually dropped upstream; this
 * is the safety net for any that are kept.)
 */
function toTicketSeverity(sev: TicketSeverity): Severity {
  return sev === "INFO" ? "LOW" : sev;
}

const RISK_SCORE: Record<Severity, number> = {
  LOW: 25,
  MEDIUM: 68,
  HIGH: 110,
  CRITICAL: 150,
};

/* ------------------------------ helpers ----------------------------------- */

function nowIso(): string {
  return new Date().toISOString();
}

/** Derive a coarse threat category from the finding title. */
function deriveThreatCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("auth") || t.includes("login") || t.includes("credential"))
    return "Authentication Weakness";
  if (t.includes("rate") || t.includes("brute"))
    return "Abuse / Rate Limiting";
  if (t.includes("cors") || t.includes("csrf") || t.includes("xss"))
    return "Web Application Attack";
  if (t.includes("inject") || t.includes("sql") || t.includes("traversal"))
    return "Injection";
  if (t.includes("expos") || t.includes("leak") || t.includes("disclos"))
    return "Information Disclosure";
  return "Security Finding";
}

/** Map a finding to a recommended-action category. */
function deriveActionCategory(title: string): RecommendedActionCategory {
  const t = title.toLowerCase();
  if (t.includes("auth") || t.includes("login") || t.includes("credential"))
    return "Authentication & Authorization";
  if (t.includes("rate") || t.includes("brute")) return "Rate Limiting";
  if (t.includes("audit") || t.includes("log")) return "Audit Logging";
  if (t.includes("access") || t.includes("cors") || t.includes("permission"))
    return "Access Control";
  if (t.includes("account")) return "Account Security";
  return "Monitoring";
}

/**
 * Stable ticket id derived from the finding so re-importing the same scan finding
 * is idempotent (the store dedups by content key too).
 */
function findingTicketId(finding: RedTeamFinding, ctx: ScanContext): string {
  const slug = `${ctx.run_id ?? "scan"}-${finding.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `INC-LMB-${slug}`;
}

/* ------------------------------- main ------------------------------------- */

/**
 * normalizeFindingToTicket — build a full SecurityTicket from one Lambda finding.
 *
 * Status / defender-action mapping (per spec):
 *   CRITICAL/HIGH → needs_review, notify_admin, action_taken=false
 *   MEDIUM        → auto_contained, notify_dev,  action_taken=true
 *   LOW/INFO      → auto_contained, none,        action_taken=true
 */
export function normalizeFindingToTicket(
  finding: RedTeamFinding,
  context: ScanContext
): SecurityTicket {
  const normalized = normalizeSeverity(finding.severity);
  const severity = toTicketSeverity(normalized);
  const risk = RISK_SCORE[severity];
  const isHigh = severity === "CRITICAL" || severity === "HIGH";
  const isMedium = severity === "MEDIUM";

  const ts = nowIso();
  const endpoint = finding.endpoint ?? context.target;
  const persona = finding.persona ?? context.attacker_name;

  const status: TicketStatus = isHigh ? "needs_review" : "auto_contained";
  const defender_action: DefenderAction = isHigh
    ? "notify_admin"
    : isMedium
    ? "notify_dev"
    : "none";
  const action_taken = !isHigh; // review-required findings are not auto-actioned

  const evidence_logs: EvidenceLog[] = finding.evidence
    ? [
        {
          id: `${findingTicketId(finding, context)}-e1`,
          timestamp: ts,
          method: "GET",
          endpoint,
          status_code: 200,
          ip: "0.0.0.0",
          user_agent: "Claude-RedTeam-Agent",
          reason: finding.evidence,
        },
      ]
    : [];

  const recommended_actions: RecommendedAction[] = finding.remediation
    ? [
        {
          id: `${findingTicketId(finding, context)}-r1`,
          priority: isHigh ? "HIGH" : isMedium ? "MEDIUM" : "LOW",
          category: deriveActionCategory(finding.title),
          title: finding.title,
          why_it_matters: finding.evidence ?? "Identified by red-team scan.",
          suggested_fix: finding.remediation,
          status: "todo",
        },
      ]
    : [];

  const automated_measures: AutomatedMeasure[] = [
    {
      id: `${findingTicketId(finding, context)}-m1`,
      name: "Finding classified",
      status: "completed",
      timestamp: ts,
      description: `Classified red-team finding as ${severity} severity.`,
    },
  ];

  const aiAnalysis = [
    `Red-team scan finding: ${finding.title}.`,
    finding.evidence ? `Evidence: ${finding.evidence}` : "",
    finding.poc ? `PoC: ${finding.poc}` : "",
    finding.confirmed !== undefined
      ? `Confirmed: ${finding.confirmed ? "yes" : "no"}.`
      : "",
    `Detected by Claude red-team agents via AWS Lambda. This is a safe simulation.`,
  ]
    .filter(Boolean)
    .join(" ");

  const timeline: TimelineEvent[] = [
    {
      id: `${findingTicketId(finding, context)}-t1`,
      timestamp: ts,
      event: "Red-team scan finding reported",
      description: `${finding.title} on ${endpoint}.`,
    },
    {
      id: `${findingTicketId(finding, context)}-t2`,
      timestamp: ts,
      event: "Finding classified",
      description: `Severity ${severity}; defender action "${defender_action}".`,
    },
  ];

  return {
    ticket_id: findingTicketId(finding, context),
    title: finding.title,
    severity,
    priority: getPriorityFromRiskScore(risk),
    risk_score: risk,
    status,
    created_at: ts,
    updated_at: ts,
    first_seen: ts,
    last_seen: ts,
    attack_type: finding.vector ? `llm_${finding.vector}` : "web_exploit",
    threat_category: deriveThreatCategory(finding.title),
    confidence: finding.confirmed ? 0.95 : 0.8,
    affected_endpoint: endpoint,
    source: "lambda",
    source_ip: undefined,
    actor_type: "external",
    user_agent: "Claude-RedTeam-Agent",
    matched_pattern: persona,
    request_count: evidence_logs.length || 1,
    detected_by: "AI Defender Agent",
    detection_source: "AWS Lambda Claude Red-Team Scan",
    defender_action,
    action_taken,
    assigned_team: "Platform Security",
    sla_due_at: new Date(new Date(ts).getTime() + 4 * 3600_000).toISOString(),
    is_grouped: false,
    automated_measures,
    evidence_logs,
    recommended_actions,
    ai_analysis: aiAnalysis,
    timeline,
    activity: [
      {
        id: `${findingTicketId(finding, context)}-a1`,
        timestamp: ts,
        actor: "AI Defender",
        message: "Ticket created from Lambda Claude red-team scan.",
      },
    ],
  };
}

/**
 * normalizeScanResponseToTickets — convert a whole scan response into tickets.
 * INFO findings are dropped (per existing ticketing convention: the queue tracks
 * actionable severities; INFO is noise).
 */
export function normalizeScanResponseToTickets(
  response: RedTeamScanResponse,
  context: ScanContext
): SecurityTicket[] {
  if (!response.ok || !response.findings) return [];
  return response.findings
    .filter((f) => normalizeSeverity(f.severity) !== "INFO")
    .map((f) => normalizeFindingToTicket(f, context));
}

/* ------------------------------- dedup ------------------------------------ */

/** Dedup key per spec: title + affected target + (persona | run_id). */
export function findingDedupKey(
  finding: RedTeamFinding,
  context: ScanContext
): string {
  const endpoint = finding.endpoint ?? context.target;
  const tail = finding.persona ?? context.run_id ?? "";
  return `${finding.title}::${endpoint}::${tail}`;
}

/** Same dedup key computed from an existing ticket. */
export function findingDedupKeyForTicket(ticket: SecurityTicket): string {
  // matched_pattern holds persona; run_id isn't stored, so persona is the tail
  // for lambda-sourced tickets (created with persona when available).
  return `${ticket.title}::${ticket.affected_endpoint}::${
    ticket.matched_pattern ?? ""
  }`;
}
