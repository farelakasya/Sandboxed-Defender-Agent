/**
 * Unified detection pipeline — the heart of Sandboxed Defender.
 *
 * Every event (fraud sim, attack sim, Lambda scan, production) flows through:
 *   DetectionEvent → classify → analyze → SecurityTicket
 *
 * This module is kept as one file for hackathon simplicity. All functions are
 * pure and framework-free.
 */

import type {
  DetectionEvent,
  DetectionClassification,
  DetectionType,
  AnalysisResult,
  MitigationAction,
  DeveloperNotification,
  FixRecommendation,
  MitigationActionType,
} from "./detectionEvent.types";
import type {
  SecurityTicket,
  AutomatedMeasure,
  EvidenceLog,
  TimelineEvent,
  DefenderAction,
  ActorType,
  Severity,
} from "./ticket.types";
import { getPriorityFromRiskScore } from "./ticket.utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let ticketCounter = 200;

function nextTicketId(): string {
  ticketCounter += 1;
  return `DET-2026-${String(ticketCounter).padStart(3, "0")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function titleCase(slug: string): string {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Classification rules (multi-label, rule-based MVP)
// ---------------------------------------------------------------------------

interface ClassificationRule {
  match: string[];
  primary: DetectionType;
  secondary: DetectionType[];
  severity: Severity;
  confidence: number;
  mitigations: MitigationActionType[];
  fixes: Array<{ title: string; priority: "HIGH" | "MEDIUM" | "LOW"; category: string; why: string; fix: string }>;
}

const RULES: ClassificationRule[] = [
  // ── Fraud-domain ──────────────────────────────────────────────
  {
    match: ["card_cracking", "card"],
    primary: "attack",
    secondary: ["fraud"],
    severity: "HIGH",
    confidence: 0.92,
    mitigations: ["rate_limit_ip", "flag_user", "notify_dev"],
    fixes: [
      { title: "Rate-limit payment attempts per device fingerprint", priority: "HIGH", category: "Rate Limiting", why: "Card cracking relies on rapid micro-transactions to validate stolen card numbers.", fix: "Max 3 payment attempts per VisitorID per 10-min window. Return 429 with Retry-After." },
      { title: "Add velocity detection for sub-$1 transactions", priority: "HIGH", category: "Monitoring", why: "Micro-charges are the hallmark of BIN-list validation attacks.", fix: "Flag devices with >5 sub-$1.00 payments in 10 minutes. Auto-block and alert." },
    ],
  },
  {
    match: ["account_takeover", "ato"],
    primary: "fraud",
    secondary: ["attack", "anomaly"],
    severity: "CRITICAL",
    confidence: 0.95,
    mitigations: ["flag_user", "disable_account", "notify_admin", "notify_dev"],
    fixes: [
      { title: "Enforce step-up MFA on high-risk signals", priority: "HIGH", category: "Authentication & Authorization", why: "ATO relies on replaying stolen credentials without additional verification.", fix: "Trigger MFA when: new device fingerprint, new country, previous failed attempts, or ML fraud score > 70." },
      { title: "Bind sessions to device fingerprint", priority: "HIGH", category: "Account Security", why: "Session hijacking is prevented when sessions are tied to the originating device.", fix: "Capture VisitorID at login. Reject requests where session VisitorID differs from auth VisitorID." },
      { title: "Add suspicious login geography detection", priority: "MEDIUM", category: "Monitoring", why: "Impossible travel or country changes are strong ATO indicators.", fix: "Alert and require re-auth when login location changes significantly within a short timeframe." },
    ],
  },
  {
    match: ["chargeback_fraud", "chargeback"],
    primary: "fraud",
    secondary: [],
    severity: "HIGH",
    confidence: 0.88,
    mitigations: ["flag_user", "suspend_export", "notify_admin"],
    fixes: [
      { title: "Build chargeback evidence collection pipeline", priority: "HIGH", category: "Audit Logging", why: "Dispute resolution requires device fingerprint, IP, delivery proof within 72h.", fix: "Log VisitorID, IP, user-agent, delivery confirmation at checkout. Retain for 540 days." },
      { title: "Enforce 3D Secure on high-value orders", priority: "HIGH", category: "Authentication & Authorization", why: "3DS shifts liability and prevents unauthorized card use.", fix: "Require 3DS authentication for orders over $300." },
    ],
  },
  {
    match: ["promo_abuse", "promo"],
    primary: "fraud",
    secondary: ["anomaly"],
    severity: "MEDIUM",
    confidence: 0.85,
    mitigations: ["flag_user", "notify_dev"],
    fixes: [
      { title: "Server-side promo validation with device binding", priority: "HIGH", category: "Access Control", why: "Multi-accounting exploits lack of device-level dedup.", fix: "One redemption per device fingerprint per campaign. Never trust client-computed discounts." },
      { title: "Detect email alias clustering", priority: "MEDIUM", category: "Monitoring", why: "user+1@, user+2@ aliases allow unlimited accounts from one email.", fix: "Canonicalize emails and check against device fingerprint clusters." },
    ],
  },
  {
    match: ["bot_checkout", "bot"],
    primary: "attack",
    secondary: ["fraud"],
    severity: "HIGH",
    confidence: 0.90,
    mitigations: ["block_ip", "rate_limit_ip", "notify_dev"],
    fixes: [
      { title: "Detect and block headless browsers at checkout", priority: "HIGH", category: "Rate Limiting", why: "Bot farms use headless Chrome to bypass JS-based detection.", fix: "Check navigator.webdriver, canvas fingerprint, mouse trajectory entropy. Serve CAPTCHA on score > 0.6." },
      { title: "Limit cart reservation per device", priority: "MEDIUM", category: "Access Control", why: "Inventory denial attacks hold hundreds of cart slots simultaneously.", fix: "Max 2 concurrent holds per VisitorID. 8-min timeout. Release on VPN detection." },
    ],
  },
  // ── Attack-domain ─────────────────────────────────────────────
  {
    match: ["credential_stuffing", "credential_stuffing_attempt"],
    primary: "attack",
    secondary: ["anomaly"],
    severity: "HIGH",
    confidence: 0.91,
    mitigations: ["rate_limit_ip", "block_ip", "notify_dev"],
    fixes: [
      { title: "Add login rate limiting with sliding window", priority: "HIGH", category: "Rate Limiting", why: "Credential stuffing relies on high-volume login attempts.", fix: "Max 5 failed attempts per IP per 15 min. Return 429 with exponential backoff." },
      { title: "Add account lockout after repeated failures", priority: "HIGH", category: "Account Security", why: "Prevents brute-force progression even when IPs rotate.", fix: "Lock account after 10 failed attempts. Require email/MFA to unlock." },
      { title: "Add MFA requirement", priority: "MEDIUM", category: "Authentication & Authorization", why: "Even compromised credentials are useless without the second factor.", fix: "Offer TOTP/WebAuthn MFA. Require for high-value actions." },
    ],
  },
  {
    match: ["stale_account_abuse", "stale_account"],
    primary: "fraud",
    secondary: ["anomaly"],
    severity: "CRITICAL",
    confidence: 0.93,
    mitigations: ["disable_account", "notify_admin", "notify_dev"],
    fixes: [
      { title: "Improve offboarding process", priority: "HIGH", category: "Access Control", why: "Stale accounts from departed employees are a major insider threat vector.", fix: "Auto-disable accounts after 90 days of inactivity. Require manager approval for re-enablement." },
      { title: "Add periodic access review", priority: "MEDIUM", category: "Access Control", why: "Regular reviews catch orphaned permissions and stale access.", fix: "Quarterly access certification for all accounts with elevated privileges." },
    ],
  },
  {
    match: ["admin_endpoint_probing"],
    primary: "attack",
    secondary: ["anomaly"],
    severity: "HIGH",
    confidence: 0.90,
    mitigations: ["block_ip", "notify_dev"],
    fixes: [
      { title: "Add JWT role validation to admin routes", priority: "HIGH", category: "Authentication & Authorization", why: "Admin endpoints should not rely only on static headers or obscurity.", fix: "Validate JWT claims and require admin role before allowing access to /api/admin/*." },
      { title: "Rate limit admin endpoints", priority: "MEDIUM", category: "Rate Limiting", why: "Repeated probing should be slowed automatically.", fix: "Apply stricter rate limits to /api/admin/*." },
    ],
  },
  {
    match: ["insider_data_access"],
    primary: "anomaly",
    secondary: ["fraud"],
    severity: "HIGH",
    confidence: 0.82,
    mitigations: ["flag_user", "notify_admin"],
    fixes: [
      { title: "Add anomaly detection threshold for data access", priority: "HIGH", category: "Monitoring", why: "Insider threats often manifest as unusual spikes in data access volume.", fix: "Alert when a user's record access exceeds 3x their 30-day average." },
      { title: "Add export approval workflow", priority: "MEDIUM", category: "Access Control", why: "Bulk exports should require secondary approval for sensitive data.", fix: "Require manager approval for exports exceeding 1000 records." },
    ],
  },
  {
    match: ["report_export_abuse"],
    primary: "fraud",
    secondary: ["attack", "anomaly"],
    severity: "CRITICAL",
    confidence: 0.91,
    mitigations: ["suspend_export", "flag_user", "notify_admin", "notify_dev"],
    fixes: [
      { title: "Restrict export permissions by role", priority: "HIGH", category: "Access Control", why: "Not all users need bulk export capability.", fix: "Limit export to verified roles. Add step-up authentication for sensitive exports." },
      { title: "Add audit logging for all export operations", priority: "HIGH", category: "Audit Logging", why: "Export operations are a primary data exfiltration vector.", fix: "Log user, timestamp, record count, and destination for every export." },
    ],
  },
  // ── Network attack types ──────────────────────────────────────
  {
    match: ["network_recon", "recon"],
    primary: "attack",
    secondary: ["anomaly"],
    severity: "MEDIUM",
    confidence: 0.78,
    mitigations: ["rate_limit_ip", "notify_dev"],
    fixes: [
      { title: "Enable topology obfuscation", priority: "MEDIUM", category: "Monitoring", why: "Network recon maps your infrastructure for follow-up attacks.", fix: "Apply selective ICMP TTL manipulation and inject decoy services." },
    ],
  },
  {
    match: ["dns_spoofing", "dns"],
    primary: "attack",
    secondary: [],
    severity: "HIGH",
    confidence: 0.85,
    mitigations: ["block_ip", "notify_admin"],
    fixes: [
      { title: "Enable DNSSEC validation", priority: "HIGH", category: "Authentication & Authorization", why: "DNS spoofing redirects traffic to attacker-controlled servers.", fix: "Enable DNSSEC on all zones. Lock resolvers to trusted upstreams." },
    ],
  },
  {
    match: ["smtp_relay_abuse", "mail"],
    primary: "attack",
    secondary: [],
    severity: "MEDIUM",
    confidence: 0.83,
    mitigations: ["block_ip", "notify_dev"],
    fixes: [
      { title: "Enforce authenticated SMTP submission", priority: "HIGH", category: "Authentication & Authorization", why: "Open relays enable spam and phishing campaigns.", fix: "Require SMTP AUTH for all outbound mail. Enforce SPF/DKIM validation." },
    ],
  },
  {
    match: ["firewall_bypass", "fw"],
    primary: "attack",
    secondary: [],
    severity: "HIGH",
    confidence: 0.87,
    mitigations: ["block_ip", "notify_admin", "notify_dev"],
    fixes: [
      { title: "Switch to stateful packet inspection", priority: "HIGH", category: "Rate Limiting", why: "Fragmented packet attacks exploit stateless firewall rules.", fix: "Enable stateful inspection. Reassemble fragments before rule evaluation." },
    ],
  },
  {
    match: ["web_exploit", "web"],
    primary: "attack",
    secondary: [],
    severity: "HIGH",
    confidence: 0.89,
    mitigations: ["block_ip", "rate_limit_ip", "notify_dev"],
    fixes: [
      { title: "Deploy WAF with SQL injection rules", priority: "HIGH", category: "Rate Limiting", why: "SQL injection is a top web exploit vector.", fix: "Enable WAF rules for SQLi, XSS, path traversal. Auto-ban on repeat violations." },
      { title: "Add input validation on all user-facing endpoints", priority: "HIGH", category: "Authentication & Authorization", why: "Unsanitized input is the root cause of injection attacks.", fix: "Validate and sanitize all input server-side. Use parameterized queries." },
    ],
  },
  {
    match: ["normal_traffic", "normal"],
    primary: "normal",
    secondary: [],
    severity: "LOW",
    confidence: 0.95,
    mitigations: ["none"],
    fixes: [],
  },
];

// ---------------------------------------------------------------------------
// classifyDetectionEvent
// ---------------------------------------------------------------------------

export function classifyDetectionEvent(
  event: DetectionEvent
): DetectionClassification {
  const eventType = event.event_type.toLowerCase();

  for (const rule of RULES) {
    if (rule.match.some((m) => eventType.includes(m))) {
      return {
        primary_type: rule.primary,
        secondary_types: rule.secondary,
        severity: rule.severity,
        confidence: rule.confidence,
        reasons: buildReasons(event, rule),
      };
    }
  }

  // Default: use domain_hint or fall back to anomaly
  return {
    primary_type: event.domain_hint ?? "anomaly",
    secondary_types: [],
    severity: "MEDIUM",
    confidence: 0.60,
    reasons: [`Unknown event type "${event.event_type}" — classified by domain hint.`],
  };
}

function buildReasons(event: DetectionEvent, rule: ClassificationRule): string[] {
  const reasons: string[] = [];
  const label = titleCase(event.event_type);

  reasons.push(`Event "${label}" matched classification rule.`);

  if (rule.secondary.length > 0) {
    const labels = rule.secondary.map(titleCase).join(" + ");
    reasons.push(`Multi-label: also classified as ${labels}.`);
  }

  if (event.actor.source_ip) {
    reasons.push(`Source IP: ${event.actor.source_ip}.`);
  }
  if (event.target.endpoint) {
    reasons.push(`Target endpoint: ${event.target.endpoint}.`);
  }
  if (event.evidence.length > 0) {
    reasons.push(`${event.evidence.length} evidence item(s) collected.`);
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// analyzeDetectionEvent
// ---------------------------------------------------------------------------

export function analyzeDetectionEvent(
  event: DetectionEvent,
  classification: DetectionClassification
): AnalysisResult {
  const ts = nowIso();
  const rule = findRule(event.event_type);

  // Build mitigation actions
  const mitigationActions: MitigationAction[] = (rule?.mitigations ?? ["none"]).map(
    (action) => ({
      action,
      status: "completed" as const,
      timestamp: ts,
      reason: describeMitigationReason(action, event),
    })
  );

  // Build fix recommendations
  const recommendedFixes: FixRecommendation[] = (rule?.fixes ?? []).map(
    (f, i) => ({
      id: `${event.event_id}-fix-${i}`,
      title: f.title,
      priority: f.priority,
      category: f.category,
      why_it_matters: f.why,
      suggested_fix: f.fix,
      status: "todo" as const,
    })
  );

  // Developer notification
  const needsNotification =
    classification.severity === "HIGH" || classification.severity === "CRITICAL";
  const developerNotification: DeveloperNotification = {
    status: needsNotification ? "sent" : "not_required",
    channel: "mock",
    recipient: needsNotification ? "security-team@sandboxed.dev" : undefined,
    timestamp: needsNotification ? ts : undefined,
  };

  // Build narrative summary
  const summary = buildAnalysisSummary(event, classification, mitigationActions);

  return {
    summary,
    classification,
    recommended_fixes: recommendedFixes,
    mitigation_actions: mitigationActions,
    developer_notification: developerNotification,
  };
}

function findRule(eventType: string): ClassificationRule | undefined {
  const lower = eventType.toLowerCase();
  return RULES.find((r) => r.match.some((m) => lower.includes(m)));
}

function describeMitigationReason(
  action: MitigationActionType,
  event: DetectionEvent
): string {
  switch (action) {
    case "block_ip":
      return `Blocked source IP ${event.actor.source_ip ?? "unknown"} from further access.`;
    case "rate_limit_ip":
      return `Applied rate limiting to ${event.actor.source_ip ?? "source"}.`;
    case "flag_user":
      return `Flagged actor ${event.actor.actor_name ?? event.actor.user_id ?? "unknown"} for review.`;
    case "disable_account":
      return `Disabled account ${event.actor.user_id ?? "unknown"} pending investigation.`;
    case "suspend_export":
      return `Suspended export operations for affected resource.`;
    case "notify_dev":
      return `Developer notification sent via mock dashboard channel.`;
    case "notify_admin":
      return `Admin notification sent for escalation.`;
    case "none":
    default:
      return `No automated action taken — low risk.`;
  }
}

function buildAnalysisSummary(
  event: DetectionEvent,
  classification: DetectionClassification,
  mitigations: MitigationAction[]
): string {
  const label = titleCase(event.event_type);
  const types = [classification.primary_type, ...classification.secondary_types]
    .map(titleCase)
    .join(" + ");
  const actionsTaken = mitigations
    .filter((m) => m.action !== "none")
    .map((m) => titleCase(m.action))
    .join(", ");

  let summary = `Detected ${label} event classified as ${types} with ${classification.severity} severity (confidence ${Math.round(classification.confidence * 100)}%).`;

  if (event.actor.source_ip) {
    summary += ` Source: ${event.actor.source_ip}.`;
  }
  if (event.target.endpoint || event.target.asset) {
    summary += ` Target: ${event.target.endpoint ?? event.target.asset}.`;
  }
  if (actionsTaken) {
    summary += ` Automated response: ${actionsTaken}.`;
  }

  return summary;
}

// ---------------------------------------------------------------------------
// createDetectionTicket — produce a SecurityTicket from pipeline output
// ---------------------------------------------------------------------------

export function createDetectionTicket(
  event: DetectionEvent,
  classification: DetectionClassification,
  analysis: AnalysisResult
): SecurityTicket {
  const ts = nowIso();
  const ticketId = nextTicketId();
  const label = titleCase(event.event_type);

  // Risk score: base from severity, boosted by multi-label
  const baseScore: Record<string, number> = {
    CRITICAL: 140,
    HIGH: 95,
    MEDIUM: 55,
    LOW: 20,
  };
  const multiLabelBonus = classification.secondary_types.length * 15;
  const riskScore =
    (baseScore[classification.severity] ?? 55) +
    multiLabelBonus +
    Math.floor(Math.random() * 20);

  // Map primary defender action
  const primaryAction = analysis.mitigation_actions.find(
    (m) => m.action !== "none" && m.action !== "notify_dev" && m.action !== "notify_admin"
  );
  const defenderAction: DefenderAction =
    (primaryAction?.action as DefenderAction) ?? "none";

  // Map actor type
  const actorType: ActorType =
    event.event_type.includes("stale") || event.event_type.includes("insider")
      ? "stale_account"
      : event.source === "fraud_simulation"
      ? "external"
      : "external";

  // Build automated measures from mitigations
  const automatedMeasures: AutomatedMeasure[] = analysis.mitigation_actions
    .filter((m) => m.action !== "none")
    .map((m, i) => ({
      id: `${ticketId}-m${i}`,
      name: titleCase(m.action),
      status: m.status,
      timestamp: m.timestamp,
      description: m.reason,
    }));

  // Build evidence logs
  const evidenceLogs: EvidenceLog[] = event.evidence.slice(0, 5).map((e, i) => ({
    id: `${ticketId}-e${i}`,
    timestamp: e.timestamp,
    method: (event.target.method as EvidenceLog["method"]) ?? "POST",
    endpoint: event.target.endpoint ?? event.target.asset ?? "unknown",
    status_code: classification.severity === "CRITICAL" || classification.severity === "HIGH" ? 403 : 200,
    ip: event.actor.source_ip ?? "0.0.0.0",
    user_agent: event.actor.user_agent ?? "unknown",
    reason: e.summary,
  }));

  // Build timeline
  const timeline: TimelineEvent[] = [
    {
      id: `${ticketId}-t1`,
      timestamp: event.created_at,
      event: `${label} detected`,
      description: `Event from ${event.source} classified as ${classification.primary_type}.`,
    },
    {
      id: `${ticketId}-t2`,
      timestamp: ts,
      event: "Automated response",
      description:
        analysis.mitigation_actions
          .filter((m) => m.action !== "none")
          .map((m) => titleCase(m.action))
          .join(", ") || "No automated action needed.",
    },
  ];

  // Map fix recommendations to the existing recommended_actions shape
  const recommendedActions = analysis.recommended_fixes.map((f) => ({
    id: f.id,
    priority: f.priority,
    title: f.title,
    category: f.category as SecurityTicket["recommended_actions"][0]["category"],
    why_it_matters: f.why_it_matters,
    suggested_fix: f.suggested_fix,
    status: f.status,
  }));

  // Determine containment status
  const hasBlockingAction = analysis.mitigation_actions.some(
    (m) => m.action === "block_ip" || m.action === "disable_account" || m.action === "suspend_export"
  );
  const containmentStatus = hasBlockingAction ? "contained" : "partial";

  // Determine ticket status
  const ticketStatus =
    containmentStatus === "contained" ? "auto_contained" : "needs_review";

  // Format types label for ticket title
  const typesLabel = [classification.primary_type, ...classification.secondary_types]
    .map(titleCase)
    .join(" + ");

  // Determine source
  const ticketSource: SecurityTicket["source"] =
    event.source === "fraud_simulation"
      ? "fraud_sim"
      : event.source === "simulation"
      ? "simulation"
      : event.source === "lambda"
      ? "lambda"
      : "log";

  return {
    ticket_id: ticketId,
    title: `${label} — ${typesLabel}`,
    severity: classification.severity,
    priority: getPriorityFromRiskScore(riskScore),
    risk_score: riskScore,
    status: ticketStatus,
    created_at: event.created_at,
    updated_at: ts,
    first_seen: event.created_at,
    last_seen: event.created_at,
    attack_type: event.event_type,
    threat_category: typesLabel,
    confidence: classification.confidence,
    affected_endpoint: event.target.endpoint ?? event.target.asset ?? "N/A",
    source: ticketSource,
    source_ip: event.actor.source_ip,
    actor_type: actorType,
    user_id: event.actor.user_id,
    user_agent: event.actor.user_agent,
    matched_pattern: `Unified Detection Pipeline — ${event.source}`,
    request_count: 1,
    detected_by: "AI Defender Agent",
    detection_source: `Unified Pipeline (${event.source})`,
    defender_action: defenderAction,
    action_taken: defenderAction !== "none",
    assigned_team: "Platform Security",
    sla_due_at: new Date(
      Date.now() + (classification.severity === "CRITICAL" ? 2 : 4) * 3600_000
    ).toISOString(),
    is_grouped: false,
    automated_measures: automatedMeasures,
    evidence_logs: evidenceLogs,
    recommended_actions: recommendedActions,
    ai_analysis: analysis.summary,
    timeline,
    activity: [
      {
        id: `${ticketId}-a1`,
        timestamp: ts,
        actor: "AI Defender",
        message: analysis.summary,
      },
      {
        id: `${ticketId}-a2`,
        timestamp: ts,
        actor: "System",
        message: `Detection ticket ${ticketId} created automatically.`,
      },
    ],
    // Unified detection fields
    detection_classification: classification,
    mitigation_actions: analysis.mitigation_actions,
    containment_status: containmentStatus,
    developer_notification: analysis.developer_notification,
    recommended_fixes: analysis.recommended_fixes,
    analyzer_summary: analysis.summary,
    detection_mode: event.mode,
  };
}

// ---------------------------------------------------------------------------
// Dedup key for detection tickets
// ---------------------------------------------------------------------------

export function detectionDedupKey(event: DetectionEvent): string {
  return `${event.event_type}::${event.target.endpoint ?? event.target.asset ?? ""}::${event.actor.source_ip ?? ""}`;
}

export function detectionDedupKeyForTicket(ticket: SecurityTicket): string {
  return `${ticket.attack_type}::${ticket.affected_endpoint ?? ""}::${ticket.source_ip ?? ""}`;
}

// ---------------------------------------------------------------------------
// enrichTicketWithDetection — add detection fields to existing tickets
// ---------------------------------------------------------------------------

export function enrichTicketWithDetection(
  ticket: SecurityTicket
): SecurityTicket {
  // Skip if already enriched
  if (ticket.detection_classification) return ticket;

  // Synthesize a DetectionEvent from existing ticket data
  const syntheticEvent: DetectionEvent = {
    event_id: ticket.ticket_id,
    created_at: ticket.created_at,
    source: "simulation",
    mode: "simulation",
    event_type: ticket.attack_type,
    actor: {
      source_ip: ticket.source_ip,
      user_agent: ticket.user_agent,
      user_id: ticket.user_id,
    },
    target: {
      endpoint: ticket.affected_endpoint,
    },
    evidence: [],
  };

  const classification = classifyDetectionEvent(syntheticEvent);
  const analysis = analyzeDetectionEvent(syntheticEvent, classification);

  return {
    ...ticket,
    detection_classification: classification,
    mitigation_actions: analysis.mitigation_actions,
    containment_status:
      ticket.status === "auto_contained" ? "contained" : "partial",
    developer_notification: analysis.developer_notification,
    recommended_fixes: analysis.recommended_fixes,
    analyzer_summary: analysis.summary,
    detection_mode: "simulation",
  };
}
