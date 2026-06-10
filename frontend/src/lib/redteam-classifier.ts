import type {
  AttackType,
  DefenderActionId,
  DefenderMeasure,
  RedTeamEvidenceLog,
  RedTeamRecommendedAction,
  Severity,
  SimulationAttackRequest,
  SimulationIncidentEvent,
} from "./redteam.types";

/**
 * Red-team classifier — the safe, simulated "AI Defender" brain.
 *
 * Turns a SimulationAttackRequest (from Bedrock or a dummy target route) into a
 * fully classified SimulationIncidentEvent: severity, the (simulated) defender
 * action, evidence, recommendations and a short analysis narrative.
 *
 * SAFETY: nothing here enforces anything. "block_ip" etc. are labels describing
 * what a real defender WOULD do; no IP is blocked, no account disabled.
 */

/* ------------------------------- id helpers ------------------------------- */

function rand(): string {
  return Math.random().toString(36).slice(2, 8);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Title-case an attack_type slug for human-readable titles. */
function humanize(attackType: string): string {
  return attackType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ----------------------- simulated status-code logic ---------------------- */

/**
 * Decide the simulated HTTP status a dummy target would return for this attack.
 * Pure + exported so the dummy target routes and the /attack receiver agree.
 *
 * Rules (per spec):
 *  - Admin endpoints → 403 for external/unknown actors.
 *  - Login + credential_stuffing → 401.
 *  - Report export → 403 unless actor is admin/auditor (internal here passes).
 *  - Stale account → 200 (succeeds) but is flagged downstream.
 */
export function resolveSimulatedStatusCode(
  req: SimulationAttackRequest
): number {
  const endpoint = req.target.endpoint.toLowerCase();
  const actor = req.attacker.actor_type;

  if (endpoint.includes("/admin")) {
    return actor === "external" || actor === "unknown" ? 403 : 200;
  }
  if (endpoint.includes("/login") || req.attack_type === "credential_stuffing") {
    return 401;
  }
  if (endpoint.includes("/reports/export")) {
    // Only internal actors with an admin/auditor-ish role pass; default deny.
    return actor === "internal" ? 200 : 403;
  }
  if (req.attack_type === "stale_account_abuse") {
    return 200; // succeeds but flagged
  }
  if (
    req.attack_type === "firewall_bypass" ||
    req.attack_type === "web_exploit"
  ) {
    return 403;
  }
  return 200;
}

/* --------------------------- per-attack mapping --------------------------- */

const THREAT_CATEGORY: Record<AttackType, string> = {
  admin_endpoint_probing: "Unauthorized Access Attempt",
  credential_stuffing: "Account Takeover Attempt",
  report_export_abuse: "Data Exfiltration",
  stale_account_abuse: "Identity & Access Risk",
  insider_data_access: "Insider Threat",
  network_recon: "Reconnaissance",
  dns_spoofing: "Network Spoofing",
  smtp_relay_abuse: "Mail Relay Abuse",
  firewall_bypass: "Perimeter Evasion",
  web_exploit: "Web Application Attack",
};

type Classification = {
  severity: Severity;
  action: DefenderActionId;
  recommendations: Array<Omit<RedTeamRecommendedAction, "id" | "status">>;
};

/**
 * Core rule table. `blocked` = simulated status >= 400 (request denied).
 * Per-spec severity / defender-action / recommendation mapping.
 */
function classify(
  req: SimulationAttackRequest,
  blocked: boolean
): Classification {
  const actor = req.attacker.actor_type;
  const endpoint = req.target.endpoint.toLowerCase();

  switch (req.attack_type) {
    case "admin_endpoint_probing":
      return {
        // HIGH if blocked/403, CRITICAL if access succeeds.
        severity: blocked ? "HIGH" : "CRITICAL",
        action: "block_ip",
        recommendations: [
          {
            priority: "HIGH",
            category: "Authentication & Authorization",
            title: "Add JWT role validation to admin routes",
            why_it_matters:
              "Admin endpoints must verify an admin role, not rely on obscurity.",
            suggested_fix:
              "Validate JWT claims and require admin role on /api/admin/*.",
          },
          {
            priority: "MEDIUM",
            category: "Access Control",
            title: "Add an IP allowlist for admin endpoints",
            why_it_matters: "External IPs should never reach admin surfaces.",
            suggested_fix: "Restrict /api/admin/* to a trusted CIDR/VPN range.",
          },
          {
            priority: "MEDIUM",
            category: "Audit Logging",
            title: "Add audit logging on admin access",
            why_it_matters: "Probing must be observable for investigation.",
            suggested_fix: "Log every admin request with actor, IP and result.",
          },
          {
            priority: "MEDIUM",
            category: "Rate Limiting",
            title: "Rate-limit admin endpoints",
            why_it_matters: "Repeated probing should be throttled automatically.",
            suggested_fix: "Apply strict per-IP rate limits to /api/admin/*.",
          },
        ],
      };

    case "credential_stuffing":
      return {
        severity: "MEDIUM",
        action: "rate_limit_ip",
        recommendations: [
          {
            priority: "HIGH",
            category: "Rate Limiting",
            title: "Add login rate limiting",
            why_it_matters: "Stuffing relies on high-volume guess attempts.",
            suggested_fix: "Throttle /login per IP and per account.",
          },
          {
            priority: "MEDIUM",
            category: "Account Security",
            title: "Add account lockout rules",
            why_it_matters: "Repeated failures should temporarily lock accounts.",
            suggested_fix: "Lock accounts after N failed attempts with backoff.",
          },
          {
            priority: "MEDIUM",
            category: "Authentication & Authorization",
            title: "Require MFA for sensitive accounts",
            why_it_matters: "MFA defeats credential reuse even when passwords leak.",
            suggested_fix: "Enforce MFA for admin/finance/auditor roles.",
          },
        ],
      };

    case "report_export_abuse": {
      const privileged = actor === "internal";
      return {
        // CRITICAL if a non-admin/internal actor abuses export.
        severity: privileged ? "HIGH" : "CRITICAL",
        action: "notify_admin",
        recommendations: [
          {
            priority: "HIGH",
            category: "Access Control",
            title: "Restrict export permission",
            why_it_matters: "Bulk export is a direct data-exfiltration path.",
            suggested_fix: "Gate /reports/export behind an explicit export role.",
          },
          {
            priority: "MEDIUM",
            category: "Audit Logging",
            title: "Add audit logging on exports",
            why_it_matters: "Every export should be attributable and reviewable.",
            suggested_fix: "Log who exported what, when and how many records.",
          },
          {
            priority: "MEDIUM",
            category: "Access Control",
            title: "Require approval for sensitive exports",
            why_it_matters: "Large exports warrant a second pair of eyes.",
            suggested_fix: "Add an approval step for exports above a threshold.",
          },
        ],
      };
    }

    case "stale_account_abuse":
      return {
        severity: "CRITICAL",
        action: "flag_user",
        recommendations: [
          {
            priority: "HIGH",
            category: "Account Security",
            title: "Disable stale accounts",
            why_it_matters: "Offboarded accounts must not retain valid access.",
            suggested_fix: "Auto-disable accounts inactive past a threshold.",
          },
          {
            priority: "MEDIUM",
            category: "Account Security",
            title: "Review the offboarding process",
            why_it_matters: "Gaps in offboarding leave live credentials behind.",
            suggested_fix: "Tie account deactivation to HR offboarding events.",
          },
          {
            priority: "MEDIUM",
            category: "Monitoring",
            title: "Add periodic access review",
            why_it_matters: "Dormant access accumulates risk over time.",
            suggested_fix: "Run quarterly access recertification.",
          },
        ],
      };

    case "insider_data_access":
      return {
        severity: "HIGH",
        action: "notify_admin",
        recommendations: [
          {
            priority: "HIGH",
            category: "Monitoring",
            title: "Add anomaly detection on client access",
            why_it_matters: "Insiders blend in; volume/pattern anomalies reveal abuse.",
            suggested_fix: "Alert on access far outside an actor's normal book.",
          },
          {
            priority: "MEDIUM",
            category: "Access Control",
            title: "Add record-level access review",
            why_it_matters: "Broad read access enables quiet exfiltration.",
            suggested_fix: "Scope client records to assigned relationship managers.",
          },
          {
            priority: "MEDIUM",
            category: "Audit Logging",
            title: "Improve audit logs for client reads",
            why_it_matters: "Investigations need a complete read trail.",
            suggested_fix: "Log every client-record read with actor and reason.",
          },
        ],
      };

    case "web_exploit":
    case "firewall_bypass":
      return {
        severity: "HIGH",
        action: endpoint.includes("/admin") ? "block_ip" : "notify_admin",
        recommendations: [
          {
            priority: "HIGH",
            category: "Access Control",
            title:
              req.attack_type === "web_exploit"
                ? "Add WAF rules for the web surface"
                : "Tighten perimeter firewall rules",
            why_it_matters:
              req.attack_type === "web_exploit"
                ? "Injection/traversal/auth-bypass target the app directly."
                : "Perimeter evasion exposes internal services.",
            suggested_fix:
              req.attack_type === "web_exploit"
                ? "Deploy WAF rules and validate/parameterize inputs."
                : "Deny-by-default at the edge and log anomalous flows.",
          },
          {
            priority: "MEDIUM",
            category: "Monitoring",
            title: "Alert on exploit/evasion signatures",
            why_it_matters: "Early detection limits blast radius.",
            suggested_fix: "Add signature + anomaly alerts to the SOC feed.",
          },
        ],
      };

    case "network_recon":
    case "dns_spoofing":
    case "smtp_relay_abuse": {
      // LOW/MEDIUM/HIGH depending on the vector's blast radius.
      const sev: Severity =
        req.attack_type === "network_recon"
          ? "LOW"
          : req.attack_type === "dns_spoofing"
          ? "HIGH"
          : "MEDIUM";
      return {
        severity: sev,
        action:
          req.attack_type === "network_recon" ? "rate_limit_ip" : "notify_admin",
        recommendations: [
          {
            priority: sev === "HIGH" ? "HIGH" : "MEDIUM",
            category: "Monitoring",
            title: `Harden against ${humanize(req.attack_type).toLowerCase()}`,
            why_it_matters:
              "Network-layer abuse enables redirection, spoofing or mapping.",
            suggested_fix:
              "Validate responses, restrict relays, and alert on scan patterns.",
          },
        ],
      };
    }

    default: {
      // Exhaustiveness guard — unknown types get a safe default.
      return {
        severity: "MEDIUM",
        action: "notify_admin",
        recommendations: [
          {
            priority: "MEDIUM",
            category: "Monitoring",
            title: "Investigate unclassified attack activity",
            why_it_matters: "Unmapped activity still warrants review.",
            suggested_fix: "Triage manually and extend classifier coverage.",
          },
        ],
      };
    }
  }
}

/* ------------------------------- assembly --------------------------------- */

function buildMeasures(
  event_id: string,
  attackType: AttackType,
  severity: Severity,
  action: DefenderActionId,
  actionTaken: boolean,
  ts: string
): DefenderMeasure[] {
  const measures: DefenderMeasure[] = [
    {
      id: `${event_id}-m1`,
      name: "Threat classified",
      status: "completed",
      timestamp: ts,
      description: `Classified red-team activity as ${attackType}.`,
    },
    {
      id: `${event_id}-m2`,
      name: "Severity assigned",
      status: "completed",
      timestamp: ts,
      description: `Assigned ${severity} severity.`,
    },
  ];

  if (action !== "none") {
    measures.push({
      id: `${event_id}-m3`,
      name: `Defender action: ${action}`,
      status: actionTaken ? "completed" : "pending",
      timestamp: ts,
      description: actionTaken
        ? `Simulated automated response "${action}" executed.`
        : `Simulated response "${action}" recommended; manual review required.`,
    });
  }
  return measures;
}

function buildAiAnalysis(
  req: SimulationAttackRequest,
  severity: Severity,
  action: DefenderActionId,
  blocked: boolean,
  statusCode: number
): string {
  const who = req.attacker.persona_name ?? req.attacker.actor_type;
  const verb = blocked ? "was denied" : "succeeded";
  return (
    `Simulated ${humanize(req.attack_type).toLowerCase()} from ${who} ` +
    `(${req.attacker.actor_type}) against ${req.target.method} ${req.target.endpoint}. ` +
    `The request ${verb} (HTTP ${statusCode}). The AI Defender assessed this as ` +
    `${severity} severity and recommends the simulated action "${action}". ` +
    `This is a controlled hackathon simulation — no real enforcement occurred.`
  );
}

/**
 * classifyAttackRequest — main entry. Pure: same input → same shape (modulo
 * generated ids/timestamps). Never throws on well-typed input.
 */
export function classifyAttackRequest(
  req: SimulationAttackRequest
): SimulationIncidentEvent {
  const ts = nowIso();
  const event_id = `RTE-${Date.now().toString(36)}-${rand()}`;
  const statusCode = resolveSimulatedStatusCode(req);
  const blocked = statusCode >= 400;

  const { severity, action, recommendations } = classify(req, blocked);
  // "Action taken" when the request was blocked, or for proactive containment
  // actions (block/rate-limit/flag). Notify-only on a succeeded request is a
  // recommendation, not a containment.
  const actionTaken =
    blocked ||
    action === "block_ip" ||
    action === "rate_limit_ip" ||
    action === "flag_user";

  const source_ip = req.attacker.source_ip ?? "203.0.113.10";
  const user_agent = req.attacker.user_agent ?? "Bedrock-RedTeam-Agent";
  const confidence = req.metadata?.confidence ?? 0.85;

  const evidence: RedTeamEvidenceLog[] = [
    {
      id: `${event_id}-e1`,
      timestamp: ts,
      method: req.target.method,
      endpoint: req.target.endpoint,
      status_code: statusCode,
      ip: source_ip,
      user_agent,
      reason:
        req.metadata?.notes ??
        `Simulated ${humanize(req.attack_type)} (${blocked ? "denied" : "allowed"}).`,
    },
  ];

  const title = `${humanize(req.attack_type)} — ${req.target.endpoint}`;

  return {
    event_id,
    run_id: req.run_id,
    created_at: ts,
    attack_type: req.attack_type,
    severity,
    confidence,
    title,
    source: "bedrock",
    attacker: {
      persona_name: req.attacker.persona_name,
      actor_type: req.attacker.actor_type,
      source_ip,
      user_id: req.attacker.user_id,
      user_agent,
    },
    target: {
      method: req.target.method,
      endpoint: req.target.endpoint,
      asset: req.target.asset,
    },
    defender: {
      action_taken: actionTaken,
      action,
      measures: buildMeasures(
        event_id,
        req.attack_type,
        severity,
        action,
        actionTaken,
        ts
      ),
    },
    evidence_logs: evidence,
    recommended_actions: recommendations.map((r, i) => ({
      ...r,
      id: `${event_id}-r${i + 1}`,
      status: "todo" as const,
    })),
    ai_analysis: buildAiAnalysis(req, severity, action, blocked, statusCode),
  };
}

export { THREAT_CATEGORY, humanize as humanizeAttackType };
