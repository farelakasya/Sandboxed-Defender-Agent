import {
  AutomatedMeasure,
  EvidenceLog,
  SecurityTicket,
  TimelineEvent,
} from "./ticket.types";
import { getPriorityFromRiskScore } from "./ticket.utils";

/**
 * Builds a fresh "live" HIGH-severity attack ticket. Extracted so both the
 * Zustand store (client) and the legacy service helper can share one shape.
 *
 * TODO(api): the backend's POST /api/tickets/simulate should return a ticket of
 * this shape; this factory becomes a dev-only fallback.
 */
export function createSimulatedTicket(sequence: number): SecurityTicket {
  const ticketId = `INC-2026-${String(sequence).padStart(3, "0")}`;
  const ts = new Date().toISOString();
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

  return {
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
}
