import {
  Priority,
  QueueMetrics,
  SecurityTicket,
  Severity,
  TicketStatus,
} from "./ticket.types";

/**
 * Presentation + derivation helpers for tickets. Pure functions only — no
 * data fetching here so they're trivially testable and reusable.
 */

export interface SeverityStyle {
  /** badge classes (bg/text/border) */
  badge: string;
  /** solid dot color */
  dot: string;
  /** left-border accent used on rows/cards */
  accent: string;
  label: string;
}

export function getSeverityStyle(severity: Severity): SeverityStyle {
  switch (severity) {
    case "CRITICAL":
      return {
        badge: "bg-red-500/15 text-red-400 border-red-500/30",
        dot: "bg-red-500",
        accent: "border-l-red-500",
        label: "Critical",
      };
    case "HIGH":
      return {
        badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",
        dot: "bg-orange-500",
        accent: "border-l-orange-500",
        label: "High",
      };
    case "MEDIUM":
      return {
        badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        dot: "bg-amber-500",
        accent: "border-l-amber-500",
        label: "Medium",
      };
    case "LOW":
    default:
      return {
        badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        dot: "bg-emerald-500",
        accent: "border-l-emerald-500",
        label: "Low",
      };
  }
}

export interface StatusStyle {
  badge: string;
  label: string;
}

export function getStatusStyle(status: TicketStatus): StatusStyle {
  switch (status) {
    case "new":
      return {
        badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        label: "New",
      };
    case "auto_contained":
      return {
        badge: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
        label: "Auto-Contained",
      };
    case "needs_review":
      return {
        badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        label: "Needs Review",
      };
    case "investigating":
      return {
        badge: "bg-violet-500/15 text-violet-400 border-violet-500/30",
        label: "Investigating",
      };
    case "escalated":
      return {
        badge: "bg-red-500/15 text-red-400 border-red-500/30",
        label: "Escalated",
      };
    case "resolved":
      return {
        badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        label: "Resolved",
      };
    case "false_positive":
    default:
      return {
        badge: "bg-muted text-muted-foreground border-border",
        label: "False Positive",
      };
  }
}

export interface PriorityStyle {
  badge: string;
  label: string;
}

export function getPriorityStyle(priority: Priority): PriorityStyle {
  switch (priority) {
    case "P1":
      return {
        badge: "bg-red-500/15 text-red-400 border-red-500/40",
        label: "P1",
      };
    case "P2":
      return {
        badge: "bg-orange-500/15 text-orange-400 border-orange-500/40",
        label: "P2",
      };
    case "P3":
      return {
        badge: "bg-amber-500/15 text-amber-400 border-amber-500/40",
        label: "P3",
      };
    case "P4":
    default:
      return {
        badge: "bg-sky-500/15 text-sky-400 border-sky-500/40",
        label: "P4",
      };
  }
}

/** Map a numeric risk score onto a priority bucket. */
export function getPriorityFromRiskScore(score: number): Priority {
  if (score >= 140) return "P1";
  if (score >= 90) return "P2";
  if (score >= 50) return "P3";
  return "P4";
}

/** Risk-score bar color, reusing severity-ish thresholds. */
export function getRiskScoreColor(score: number): string {
  if (score >= 140) return "text-red-400";
  if (score >= 90) return "text-orange-400";
  if (score >= 50) return "text-amber-400";
  return "text-emerald-400";
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate()
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds()
  )} UTC`;
}

export function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds()
  )}`;
}

/** Human "x minutes ago" relative time. */
export function formatRelativeTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 0) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}

const OPEN_STATUSES: TicketStatus[] = [
  "new",
  "auto_contained",
  "needs_review",
  "investigating",
  "escalated",
];

/** Aggregate KPI metrics from a ticket list. */
export function calculateQueueMetrics(tickets: SecurityTicket[]): QueueMetrics {
  const blockedIps = new Set<string>();
  let suppressedEvents = 0;

  for (const t of tickets) {
    if (
      (t.defender_action === "block_ip" || t.defender_action === "rate_limit_ip") &&
      t.action_taken &&
      t.source_ip
    ) {
      blockedIps.add(t.source_ip);
    }
    suppressedEvents += t.suppressed_event_count ?? 0;
  }

  return {
    total: tickets.length,
    open: tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length,
    criticalHigh: tickets.filter(
      (t) => t.severity === "CRITICAL" || t.severity === "HIGH"
    ).length,
    autoContained: tickets.filter((t) => t.status === "auto_contained").length,
    needsReview: tickets.filter((t) => t.status === "needs_review").length,
    blockedIps: blockedIps.size,
    suppressedEvents,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    grouped: tickets.filter((t) => t.is_grouped).length,
  };
}

/** A ticket is overdue if it's still open past its SLA due time. */
export function isTicketOverdue(ticket: SecurityTicket): boolean {
  if (!ticket.sla_due_at) return false;
  if (ticket.status === "resolved" || ticket.status === "false_positive") {
    return false;
  }
  const due = new Date(ticket.sla_due_at).getTime();
  if (Number.isNaN(due)) return false;
  return Date.now() > due;
}

/** Short label for the source field. */
export function formatSource(source: SecurityTicket["source"]): string {
  switch (source) {
    case "pentagi":
      return "PentAGI";
    case "combined":
      return "Combined";
    case "log":
    default:
      return "Log";
  }
}

export function formatActorType(actor: SecurityTicket["actor_type"]): string {
  switch (actor) {
    case "external":
      return "External";
    case "internal":
      return "Internal";
    case "stale_account":
      return "Stale Account";
    case "unknown":
    default:
      return "Unknown";
  }
}

export function formatDefenderAction(action: SecurityTicket["defender_action"]): string {
  switch (action) {
    case "block_ip":
      return "Blocked IP";
    case "rate_limit_ip":
      return "Rate-limited IP";
    case "flag_user":
      return "Flagged user";
    case "notify_admin":
      return "Notified admin";
    case "notify_dev":
      return "Notified developer";
    case "none":
    default:
      return "No action";
  }
}

/** Title-case an attack_type slug, e.g. admin_endpoint_probing -> "Admin Endpoint Probing". */
export function humanizeAttackType(attackType: string): string {
  return attackType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
