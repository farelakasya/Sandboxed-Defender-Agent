/**
 * Builds a presentation-layer AttackerReport from a launch result + vector.
 *
 * Works for both modes:
 *  - mock: synthesizes a realistic 3–5 step run with findings + defender result
 *    derived from the vector's simulated_signals / recommended_mitigations.
 *  - external: if the collaborator backend returned a structured report, that is
 *    preferred (normalizeExternalReport); otherwise we fall back to the same
 *    synthesis so the launch page always has something to show.
 *
 * This never creates defender tickets. linked_ticket_ids stays empty until the
 * defender backend records the matching verdict.
 */
import type {
  AttackerReport,
  AttackerReportFinding,
  AttackerReportSeverity,
  AttackerReportStatus,
  AttackerReportStep,
} from "./attacker-report.types";
import type {
  SimulationLaunchRequest,
  SimulationLaunchResponse,
  SimulationVector,
} from "./testing-launch.types";

function nowIso(): string {
  return new Date().toISOString();
}

function shortId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Vectors whose runs we treat as fully contained by the defender. */
const CONTAINED_BY_DEFAULT = new Set([
  "admin_endpoint_probing",
  "credential_stuffing",
  "firewall_bypass",
  "network_recon",
  "card_cracking",
  "bot_checkout",
  "account_takeover",
]);

/** Pick a headline severity from the vector's detection labels / domain. */
function severityForVector(vector: SimulationVector): AttackerReportSeverity {
  const cat = (vector.category ?? "").toLowerCase();
  if (cat.includes("access_control") || cat.includes("authentication")) return "HIGH";
  if (vector.domain === "fraud") return "HIGH";
  return "MEDIUM";
}

function humanizeSignal(signal: string): string {
  return signal
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Synthesize a mock report for a vector. `contained` controls whether the
 * defender blocked the run (drives step statuses + defender_result).
 */
export function buildMockAttackerReport(
  request: SimulationLaunchRequest,
  vector: SimulationVector,
  runId: string,
  status: AttackerReportStatus = "completed"
): AttackerReport {
  const ts = nowIso();
  const contained = CONTAINED_BY_DEFAULT.has(vector.id);
  const signals = vector.simulated_signals.slice(0, 4);

  // 3–5 steps: recon → attempt(s) → defender response.
  const steps: AttackerReportStep[] = [];
  steps.push({
    step_id: shortId("step"),
    label: `Reconnaissance against ${request.target.endpoint ?? request.target.target_type}`,
    status: "succeeded",
    timestamp: ts,
    evidence: `Probed ${request.target.base_url}${request.target.endpoint ?? ""}`,
  });
  signals.forEach((sig, i) => {
    // Once the defender contains the run, later attempts are blocked.
    const blocked = contained && i >= 1;
    steps.push({
      step_id: shortId("step"),
      label: `Attempt: ${humanizeSignal(sig)}`,
      status: blocked ? "blocked" : "attempted",
      timestamp: ts,
      evidence: blocked
        ? "Request rejected by defender control."
        : `Observed signal: ${sig}`,
    });
  });
  steps.push({
    step_id: shortId("step"),
    label: contained ? "Defender contained the run" : "Run completed",
    status: contained ? "blocked" : "succeeded",
    timestamp: ts,
    evidence: contained
      ? `Mitigations applied: ${vector.recommended_mitigations.slice(0, 2).join(", ")}`
      : "No blocking control triggered.",
  });

  const headlineSeverity = severityForVector(vector);
  const findings: AttackerReportFinding[] = [
    {
      finding_id: shortId("find"),
      title: `${vector.name} attempted against ${request.target.target_type}`,
      severity: headlineSeverity,
      description:
        vector.description ??
        `Simulated ${vector.name} run against the target.`,
      evidence: signals.map(humanizeSignal),
      recommendation: vector.recommended_mitigations
        .filter((m) => m !== "notify_developer")
        .slice(0, 3)
        .join("; "),
    },
  ];

  const blockedSteps = steps.filter((s) => s.status === "blocked").length;
  const successfulSteps = steps.filter((s) => s.status === "succeeded").length;

  return {
    report_id: shortId("rep"),
    run_id: runId,
    created_at: ts,
    domain: vector.domain,
    vector_id: vector.id,
    vector_name: vector.name,
    target: {
      base_url: request.target.base_url,
      endpoint: request.target.endpoint,
      target_type: request.target.target_type,
    },
    status,
    summary: {
      total_steps: steps.length,
      successful_steps: successfulSteps,
      blocked_steps: blockedSteps,
      findings_count: findings.length,
      highest_severity: headlineSeverity,
    },
    steps,
    findings,
    defender_result: {
      detected: true,
      contained,
      mitigation_actions: contained
        ? vector.recommended_mitigations.filter((m) => m !== "notify_developer")
        : [],
      // Empty until the defender backend records the matching verdict.
      linked_ticket_ids: [],
    },
  };
}

/**
 * Build the report from a completed launch response. Prefers a structured
 * report the collaborator backend may have returned (result.report); otherwise
 * synthesizes from the vector. Returns null if the run failed.
 */
export function reportFromLaunchResult(
  request: SimulationLaunchRequest,
  vector: SimulationVector,
  response: SimulationLaunchResponse
): AttackerReport | null {
  if (!response.ok) return null;

  // External backend may already provide a structured report.
  const external = (response.result as { report?: AttackerReport } | undefined)
    ?.report;
  if (external && typeof external === "object" && external.report_id) {
    return external;
  }

  const status: AttackerReportStatus =
    response.status === "completed" ||
    response.status === "queued" ||
    response.status === "running" ||
    response.status === "failed"
      ? response.status
      : "completed";

  return buildMockAttackerReport(
    request,
    vector,
    response.run_id ?? shortId("run"),
    status
  );
}
