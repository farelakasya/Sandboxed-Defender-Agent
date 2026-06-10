import {
  DefenderAction,
  RecommendedActionCategory,
  SecurityTicket,
  Severity,
  TicketStatus,
} from "./ticket.types";

/**
 * Pure derivation layer for the dashboard. Every number here is computed from
 * the live `tickets` array (the Zustand store) — nothing is hardcoded except
 * empty-state fallbacks. Keeping this pure makes the dashboard reactive: when
 * the store changes (e.g. the simulator creates a ticket), recomputing these
 * yields fresh metrics with no extra wiring.
 *
 * TODO(api): when a backend exists, some aggregates (e.g. top endpoints across
 * all history) may move server-side behind GET /api/dashboard/metrics. The
 * function signatures can stay identical.
 */

/** Statuses considered "closed" — excluded from active/threat counts. */
const CLOSED_STATUSES: TicketStatus[] = ["resolved", "false_positive"];

export function isActive(t: SecurityTicket): boolean {
  return !CLOSED_STATUSES.includes(t.status);
}

export function isHighRisk(t: SecurityTicket): boolean {
  return t.severity === "CRITICAL" || t.severity === "HIGH";
}

/* --------------------------------- KPIs ----------------------------------- */

export type QueueHealth = "Stable" | "Busy" | "Overloaded";

export interface DashboardMetrics {
  activeThreats: number;
  highRiskTickets: number;
  autoContained: number;
  needsReview: number;
  blockedIps: number;
  queueHealth: QueueHealth;
  totalTickets: number;
}

/** Inputs to the queue-health calculation, all derived from the ticket store. */
export interface QueueHealthMetrics {
  activeTickets: number;
  highRiskTickets: number;
  recentAttacks15m: number;
  suppressedEvents: number;
  groupedEvents: number;
}

export interface QueueHealthResult {
  status: QueueHealth;
  reason: string;
  metrics: QueueHealthMetrics;
  /** Human-readable list of every threshold currently breached. */
  triggeredBy: string[];
}

/**
 * Threshold table. Each metric has a Busy floor and an Overloaded floor. These
 * are exported so the explanation popover can render the exact same numbers the
 * logic uses (no drift between code and UI).
 */
export const QUEUE_HEALTH_THRESHOLDS = {
  activeTickets: { busy: 20, overloaded: 50 },
  highRiskTickets: { busy: 5, overloaded: 15 },
  recentAttacks15m: { busy: 5, overloaded: 20 },
  suppressedEvents: { busy: 50, overloaded: 150 },
} as const;

const RECENT_WINDOW_MS = 15 * 60 * 1000;

/** Strongest-first reasons, used to pick the single headline reason. */
const OVERLOADED_REASONS: Record<keyof typeof QUEUE_HEALTH_THRESHOLDS, string> = {
  recentAttacks15m: "Attack spike detected",
  suppressedEvents: "Suppressed duplicate events exceeded threshold",
  highRiskTickets: "Too many high-risk tickets",
  activeTickets: "Active ticket volume critically high",
};
const BUSY_REASONS: Record<keyof typeof QUEUE_HEALTH_THRESHOLDS, string> = {
  recentAttacks15m: "Recent attack activity is rising",
  highRiskTickets: "High-risk tickets need attention",
  suppressedEvents: "Suppressed duplicate events are climbing",
  activeTickets: "Elevated active ticket volume",
};

// Priority order for choosing the single headline reason.
const REASON_PRIORITY: Array<keyof typeof QUEUE_HEALTH_THRESHOLDS> = [
  "recentAttacks15m",
  "suppressedEvents",
  "highRiskTickets",
  "activeTickets",
];

export function getQueueHealthMetrics(
  tickets: SecurityTicket[]
): QueueHealthMetrics {
  const now = Date.now();
  let suppressedEvents = 0;
  let groupedEvents = 0;
  let recentAttacks15m = 0;

  for (const t of tickets) {
    suppressedEvents += t.suppressed_event_count ?? 0;
    groupedEvents += t.grouped_event_count ?? 0;
    const created = new Date(t.created_at).getTime();
    if (!Number.isNaN(created) && now - created <= RECENT_WINDOW_MS) {
      recentAttacks15m += 1;
    }
  }

  return {
    activeTickets: tickets.filter(isActive).length,
    highRiskTickets: tickets.filter((t) => isActive(t) && isHighRisk(t)).length,
    recentAttacks15m,
    suppressedEvents,
    groupedEvents,
  };
}

/**
 * Calculate queue health from real ticket data.
 *
 *   Overloaded — any Overloaded threshold met (overrides Busy)
 *   Busy       — any Busy threshold met (overrides Stable)
 *   Stable     — none met
 *
 * The headline reason is the strongest breached threshold (attack spikes and
 * suppression weigh highest). Empty store → Stable / "No active security tickets".
 */
export function calculateQueueHealth(
  tickets: SecurityTicket[]
): QueueHealthResult {
  const metrics = getQueueHealthMetrics(tickets);

  if (tickets.length === 0) {
    return {
      status: "Stable",
      reason: "No active security tickets",
      metrics,
      triggeredBy: [],
    };
  }

  const overloadedKeys = REASON_PRIORITY.filter(
    (k) => metrics[k] >= QUEUE_HEALTH_THRESHOLDS[k].overloaded
  );
  const busyKeys = REASON_PRIORITY.filter(
    (k) => metrics[k] >= QUEUE_HEALTH_THRESHOLDS[k].busy
  );

  if (overloadedKeys.length > 0) {
    const top = overloadedKeys[0];
    return {
      status: "Overloaded",
      reason: OVERLOADED_REASONS[top],
      metrics,
      triggeredBy: overloadedKeys.map(
        (k) => `${k} ≥ ${QUEUE_HEALTH_THRESHOLDS[k].overloaded}`
      ),
    };
  }

  if (busyKeys.length > 0) {
    const top = busyKeys[0];
    return {
      status: "Busy",
      reason: BUSY_REASONS[top],
      metrics,
      triggeredBy: busyKeys.map(
        (k) => `${k} ≥ ${QUEUE_HEALTH_THRESHOLDS[k].busy}`
      ),
    };
  }

  return {
    status: "Stable",
    reason: "Queue volume is normal",
    metrics,
    triggeredBy: [],
  };
}

/** Back-compat helper: just the status string. Delegates to calculateQueueHealth. */
export function getQueueHealth(tickets: SecurityTicket[]): QueueHealth {
  return calculateQueueHealth(tickets).status;
}

export function calculateDashboardMetrics(
  tickets: SecurityTicket[]
): DashboardMetrics {
  const blockedIps = new Set<string>();
  for (const t of tickets) {
    if (t.defender_action === "block_ip" && t.action_taken && t.source_ip) {
      blockedIps.add(t.source_ip);
    }
  }

  return {
    activeThreats: tickets.filter(isActive).length,
    highRiskTickets: tickets.filter((t) => isActive(t) && isHighRisk(t)).length,
    autoContained: tickets.filter((t) => t.status === "auto_contained").length,
    needsReview: tickets.filter((t) => t.status === "needs_review").length,
    blockedIps: blockedIps.size,
    queueHealth: getQueueHealth(tickets),
    totalTickets: tickets.length,
  };
}

/* -------------------------- severity distribution ------------------------- */

export interface SeveritySlice {
  severity: Severity;
  count: number;
}

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function getSeverityDistribution(
  tickets: SecurityTicket[]
): SeveritySlice[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    count: tickets.filter((t) => t.severity === severity).length,
  }));
}

/** "% of active tickets that are high-risk", rounded. 0 when no active tickets. */
export function getHighRiskShareOfActive(tickets: SecurityTicket[]): number {
  const active = tickets.filter(isActive);
  if (active.length === 0) return 0;
  const high = active.filter(isHighRisk).length;
  return Math.round((high / active.length) * 100);
}

/* ------------------------- attack type distribution ----------------------- */

export interface AttackTypeCount {
  attack_type: string;
  count: number;
}

export function getAttackTypeDistribution(
  tickets: SecurityTicket[]
): AttackTypeCount[] {
  const counts = new Map<string, number>();
  for (const t of tickets) {
    counts.set(t.attack_type, (counts.get(t.attack_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([attack_type, count]) => ({ attack_type, count }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------- automated defense summary ---------------------- */

export interface DefenseSummaryItem {
  action: DefenderAction;
  label: string;
  count: number;
}

const DEFENSE_LABELS: Record<DefenderAction, string> = {
  block_ip: "IP Blocked",
  rate_limit_ip: "Rate Limited",
  flag_user: "Users Flagged",
  notify_admin: "Admin Notified",
  notify_dev: "Dev Notified",
  none: "No Action",
};

const DEFENSE_ORDER: DefenderAction[] = [
  "block_ip",
  "rate_limit_ip",
  "flag_user",
  "notify_admin",
  "notify_dev",
  "none",
];

/**
 * Count tickets per defender action. Only counts actions that were actually
 * taken (except "none", which represents the absence of action).
 */
export function getAutomatedDefenseSummary(
  tickets: SecurityTicket[]
): DefenseSummaryItem[] {
  const counts = new Map<DefenderAction, number>();
  for (const t of tickets) {
    const a = t.defender_action;
    if (a === "none" || t.action_taken) {
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
  }
  return DEFENSE_ORDER.map((action) => ({
    action,
    label: DEFENSE_LABELS[action],
    count: counts.get(action) ?? 0,
  }));
}

/* --------------------------- latest high-risk ----------------------------- */

export function getLatestHighRiskTickets(
  tickets: SecurityTicket[],
  limit = 5
): SecurityTicket[] {
  return tickets
    .filter((t) => isActive(t) && isHighRisk(t))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
}

/* --------------------------- live defense timeline ------------------------ */

export interface DefenseFeedItem {
  id: string;
  ticket_id: string;
  ticket_title: string;
  actor: string;
  message: string;
  timestamp: string;
}

/**
 * Flatten every ticket's activity feed into one chronological stream. Activity
 * items already capture "IP blocked", "ticket created", "admin notified", etc.
 */
export function getLiveDefenseTimeline(
  tickets: SecurityTicket[],
  limit = 8
): DefenseFeedItem[] {
  const items: DefenseFeedItem[] = [];
  for (const t of tickets) {
    for (const a of t.activity) {
      items.push({
        id: `${t.ticket_id}-${a.id}`,
        ticket_id: t.ticket_id,
        ticket_title: t.title,
        actor: a.actor,
        message: a.message,
        timestamp: a.timestamp,
      });
    }
  }
  return items
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, limit);
}

/* --------------------------- top attacked endpoints ----------------------- */

export interface EndpointCount {
  endpoint: string;
  attempts: number;
}

/**
 * Rank endpoints by total attack volume. Uses request_count per ticket (the
 * number of attempts that ticket represents), falling back to evidence log
 * count when request_count is missing/zero.
 */
export function getTopAttackedEndpoints(
  tickets: SecurityTicket[],
  limit = 5
): EndpointCount[] {
  const counts = new Map<string, number>();
  for (const t of tickets) {
    const attempts = t.request_count || t.evidence_logs.length || 1;
    counts.set(t.affected_endpoint, (counts.get(t.affected_endpoint) ?? 0) + attempts);
  }
  return [...counts.entries()]
    .map(([endpoint, attempts]) => ({ endpoint, attempts }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, limit);
}

/* --------------------------- recommended fixes ---------------------------- */

export interface FixSummary {
  title: string;
  category: RecommendedActionCategory;
  priority: "HIGH" | "MEDIUM" | "LOW";
  ticketsAffected: number;
  exampleEndpoint: string;
  suggestedFix: string;
}

const PRIORITY_WEIGHT: Record<FixSummary["priority"], number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Aggregate recommended actions across all UNRESOLVED tickets, grouped by fix
 * title. Counts how many distinct tickets each fix affects, then ranks by
 * (tickets affected, priority).
 */
export function getRecommendedFixesSummary(
  tickets: SecurityTicket[],
  limit = 6
): FixSummary[] {
  const byTitle = new Map<
    string,
    FixSummary & { _ticketIds: Set<string> }
  >();

  for (const t of tickets) {
    if (!isActive(t)) continue;
    for (const rec of t.recommended_actions) {
      if (rec.status === "done") continue;
      const existing = byTitle.get(rec.title);
      if (existing) {
        existing._ticketIds.add(t.ticket_id);
        // Keep the highest priority seen for this fix.
        if (PRIORITY_WEIGHT[rec.priority] > PRIORITY_WEIGHT[existing.priority]) {
          existing.priority = rec.priority;
        }
      } else {
        byTitle.set(rec.title, {
          title: rec.title,
          category: rec.category,
          priority: rec.priority,
          ticketsAffected: 0,
          exampleEndpoint: t.affected_endpoint,
          suggestedFix: rec.suggested_fix,
          _ticketIds: new Set([t.ticket_id]),
        });
      }
    }
  }

  return [...byTitle.values()]
    .map(({ _ticketIds, ...rest }) => ({
      ...rest,
      ticketsAffected: _ticketIds.size,
    }))
    .sort(
      (a, b) =>
        b.ticketsAffected - a.ticketsAffected ||
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    )
    .slice(0, limit);
}
