import { MOCK_TICKETS } from "@/data/mockTickets";
import {
  AutomatedMeasure,
  EvidenceLog,
  SecurityTicket,
  TicketStatus,
  TimelineEvent,
} from "./ticket.types";
import { getPriorityFromRiskScore } from "./ticket.utils";

/**
 * Data-access layer for tickets (future backend boundary).
 *
 * NOTE: For the current MVP, client-side ticket state lives in the Zustand
 * store at /src/stores/ticket.store.ts, which is what the queue and detail
 * pages read/write. This module is kept as the documented seam for the real
 * API — once the backend exists, the store's actions should delegate here and
 * this becomes the single place that knows where data comes from.
 *
 * Future API mapping:
 *   getTickets()                     -> GET   /api/tickets
 *   getTicketById(id)                -> GET   /api/tickets/:ticketId
 *   updateTicketStatus(id, status)   -> PATCH /api/tickets/:ticketId/status
 *   simulateNewTicket()              -> POST  /api/tickets/simulate
 *   simulateOverload()               -> POST  /api/tickets/overload
 */

// In-memory working copy so simulations/mutations persist within a session.
// TODO(api): remove this once the backend is the source of truth.
let tickets: SecurityTicket[] = structuredClone(MOCK_TICKETS);

const SIMULATED_LATENCY_MS = 120;

/** Tiny delay so the UI exercises its loading/async paths like a real fetch. */
function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(value), SIMULATED_LATENCY_MS)
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * GET /api/tickets
 * Returns all tickets, newest first.
 */
export async function getTickets(): Promise<SecurityTicket[]> {
  // TODO(api): const res = await fetch(`${API_BASE}/api/tickets`);
  //            return (await res.json()) as SecurityTicket[];
  const sorted = [...tickets].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return delay(sorted);
}

/**
 * GET /api/tickets/:ticketId
 */
export async function getTicketById(
  ticketId: string
): Promise<SecurityTicket | null> {
  // TODO(api): const res = await fetch(`${API_BASE}/api/tickets/${ticketId}`);
  //            if (res.status === 404) return null;
  //            return (await res.json()) as SecurityTicket;
  const found = tickets.find((t) => t.ticket_id === ticketId) ?? null;
  return delay(found);
}

/**
 * PATCH /api/tickets/:ticketId/status
 * Updates status locally and appends a system activity item.
 */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<SecurityTicket | null> {
  // TODO(api): const res = await fetch(
  //              `${API_BASE}/api/tickets/${ticketId}/status`,
  //              { method: "PATCH", body: JSON.stringify({ status }) }
  //            );
  //            return (await res.json()) as SecurityTicket;
  const ticket = tickets.find((t) => t.ticket_id === ticketId);
  if (!ticket) return delay(null);
  ticket.status = status;
  ticket.updated_at = nowIso();
  ticket.activity = [
    ...ticket.activity,
    {
      id: `a-${Date.now()}`,
      timestamp: nowIso(),
      actor: "System",
      message: `Status changed to "${status.replace(/_/g, " ")}".`,
    },
  ];
  return delay(ticket);
}

let simCounter = 100;

/**
 * POST /api/tickets/simulate
 * Creates a fresh HIGH-severity ticket and returns it (added to the queue top).
 */
export async function simulateNewTicket(): Promise<SecurityTicket> {
  // TODO(api): const res = await fetch(`${API_BASE}/api/tickets/simulate`, { method: "POST" });
  //            const created = (await res.json()) as SecurityTicket;
  //            return created;
  simCounter += 1;
  const ticketId = `INC-2026-${String(simCounter).padStart(3, "0")}`;
  const ts = nowIso();
  const ip = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
  const riskScore = 95 + Math.floor(Math.random() * 30);

  const measures: AutomatedMeasure[] = [
    {
      id: `${ticketId}-m1`,
      name: "Threat classified",
      status: "completed",
      timestamp: ts,
      description: "Classified as admin_endpoint_probing.",
    },
    {
      id: `${ticketId}-m2`,
      name: "Severity assigned",
      status: "completed",
      timestamp: ts,
      description: `Assigned HIGH severity (risk score ${riskScore}).`,
    },
    {
      id: `${ticketId}-m3`,
      name: "IP blocked",
      status: "completed",
      timestamp: ts,
      description: `Added ${ip} to the temporary blocklist.`,
    },
  ];

  const evidence: EvidenceLog[] = [
    {
      id: `${ticketId}-e1`,
      timestamp: ts,
      method: "POST",
      endpoint: "/api/admin/reset-user-data",
      status_code: 403,
      ip,
      user_agent: "curl/8.0",
      reason: "External actor attempted admin endpoint.",
    },
    {
      id: `${ticketId}-e2`,
      timestamp: ts,
      method: "GET",
      endpoint: "/api/admin/users",
      status_code: 403,
      ip,
      user_agent: "curl/8.0",
      reason: "Unauthorized admin route access.",
    },
  ];

  const timeline: TimelineEvent[] = [
    {
      id: `${ticketId}-t1`,
      timestamp: ts,
      event: "Attack request received",
      description: `External IP ${ip} probed admin routes.`,
    },
    {
      id: `${ticketId}-t2`,
      timestamp: ts,
      event: "Automated response executed",
      description: "Source IP blocked automatically.",
    },
  ];

  const newTicket: SecurityTicket = {
    ticket_id: ticketId,
    title: "Admin Endpoint Probing Detected (Live)",
    severity: "HIGH",
    priority: getPriorityFromRiskScore(riskScore),
    risk_score: riskScore,
    status: "auto_contained",
    created_at: ts,
    updated_at: ts,
    first_seen: ts,
    last_seen: ts,
    attack_type: "admin_endpoint_probing",
    threat_category: "Unauthorized Access Attempt",
    confidence: 0.9,
    affected_endpoint: "POST /api/admin/reset-user-data",
    source: "pentagi",
    source_ip: ip,
    actor_type: "external",
    user_agent: "curl/8.0",
    matched_pattern: "External Admin Endpoint Hunter",
    request_count: 8 + Math.floor(Math.random() * 20),
    detected_by: "AI Defender Agent",
    detection_source: "Backend / Nginx Logs",
    defender_action: "block_ip",
    action_taken: true,
    assigned_team: "Platform Security",
    sla_due_at: new Date(Date.now() + 4 * 3600_000).toISOString(),
    is_grouped: false,
    automated_measures: measures,
    evidence_logs: evidence,
    recommended_actions: [
      {
        id: `${ticketId}-r1`,
        priority: "HIGH",
        title: "Add JWT role validation to admin routes",
        category: "Authentication & Authorization",
        why_it_matters:
          "Admin endpoints should not rely only on static headers or obscurity.",
        suggested_fix:
          "Validate JWT claims and require admin role before allowing access to /api/admin/*.",
        status: "todo",
      },
      {
        id: `${ticketId}-r2`,
        priority: "MEDIUM",
        title: "Rate limit admin endpoints",
        category: "Rate Limiting",
        why_it_matters: "Repeated probing should be slowed automatically.",
        suggested_fix: "Apply stricter rate limits to /api/admin/*.",
        status: "todo",
      },
    ],
    ai_analysis:
      "A new external actor was observed probing admin routes and receiving repeated 403 responses. The system blocked the source IP automatically and recommends strengthening authentication and rate limiting on admin endpoints.",
    timeline,
    activity: [
      {
        id: `${ticketId}-a1`,
        timestamp: ts,
        actor: "AI Defender",
        message: `Blocked ${ip} after live admin probing.`,
      },
      {
        id: `${ticketId}-a2`,
        timestamp: ts,
        actor: "System",
        message: `Ticket ${ticketId} created automatically.`,
      },
    ],
  };

  tickets = [newTicket, ...tickets];
  return delay(newTicket);
}

const CAMPAIGN_ID = "INC-2026-006";

/**
 * POST /api/tickets/overload
 * Simulates a flood of related admin-probing events. Rather than create many
 * rows, it grows the single grouped campaign ticket and bumps suppression.
 * Returns the campaign ticket.
 */
export async function simulateOverload(): Promise<SecurityTicket> {
  // TODO(api): const res = await fetch(`${API_BASE}/api/tickets/overload`, { method: "POST" });
  //            return (await res.json()) as SecurityTicket;
  const ts = nowIso();
  const newEvents = 40 + Math.floor(Math.random() * 40);
  const newSuppressed = 80 + Math.floor(Math.random() * 120);

  let campaign = tickets.find((t) => t.ticket_id === CAMPAIGN_ID);
  if (!campaign) {
    // Fall back to any grouped ticket, else clone the canonical campaign.
    campaign =
      tickets.find((t) => t.is_grouped) ??
      structuredClone(MOCK_TICKETS.find((t) => t.ticket_id === CAMPAIGN_ID)!);
    if (!tickets.includes(campaign)) tickets = [campaign, ...tickets];
  }

  campaign.grouped_event_count =
    (campaign.grouped_event_count ?? 0) + newEvents;
  campaign.suppressed_event_count =
    (campaign.suppressed_event_count ?? 0) + newSuppressed;
  campaign.request_count += newEvents;
  campaign.last_seen = ts;
  campaign.updated_at = ts;
  campaign.status = "auto_contained";
  campaign.activity = [
    ...campaign.activity,
    {
      id: `a-${Date.now()}`,
      timestamp: ts,
      actor: "AI Defender",
      message: `Overload: grouped ${newEvents} more events, suppressed ${newSuppressed} duplicates.`,
    },
  ];

  return delay(campaign);
}

/**
 * Reset the in-memory store to the original mock data. Useful for demos.
 * Not part of the future API surface.
 */
export async function resetTickets(): Promise<void> {
  tickets = structuredClone(MOCK_TICKETS);
  simCounter = 100;
  return delay(undefined);
}
