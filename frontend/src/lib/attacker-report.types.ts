/**
 * Simple attacker/fraud report model for the Testing/Launch side.
 *
 * This is a presentation model for the launch pages only — it summarizes what a
 * red-team / fraud run attempted and what the defender did. It is NOT a ticket
 * source: the defender backend DB remains the source of truth for tickets.
 * A report may reference defender tickets via `mapped_ticket_id` /
 * `linked_ticket_ids` once the backend records the corresponding verdict.
 */

export type AttackerReportDomain = "attack" | "fraud";

export type AttackerReportSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AttackerReportStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type AttackerReportStepStatus =
  | "attempted"
  | "blocked"
  | "succeeded"
  | "failed";

export type AttackerReportStep = {
  step_id: string;
  label: string;
  status: AttackerReportStepStatus;
  timestamp: string;
  evidence?: string;
};

export type AttackerReportFinding = {
  finding_id: string;
  title: string;
  severity: AttackerReportSeverity;
  description: string;
  evidence?: string[];
  recommendation?: string;
  mapped_ticket_id?: string;
};

export type AttackerReport = {
  report_id: string;
  run_id: string;
  created_at: string;
  domain: AttackerReportDomain;
  vector_id: string;
  vector_name: string;
  target: {
    base_url?: string;
    endpoint?: string;
    target_type?: string;
  };
  status: AttackerReportStatus;
  summary: {
    total_steps: number;
    successful_steps: number;
    blocked_steps: number;
    findings_count: number;
    highest_severity?: AttackerReportSeverity;
  };
  steps: AttackerReportStep[];
  findings: AttackerReportFinding[];
  defender_result?: {
    detected?: boolean;
    contained?: boolean;
    mitigation_actions?: string[];
    linked_ticket_ids?: string[];
  };
};

/**
 * Unified launch response surfaced to the launch pages. Layers an optional
 * structured `report` on top of the existing run_id/status/provider fields so
 * the pages can render an AttackerReportPanel without changing the underlying
 * /api/testing/launch contract.
 */
export type LaunchSimulationResponse = {
  ok: boolean;
  run_id?: string;
  status: AttackerReportStatus;
  provider: "mock" | "attacker_app";
  message: string;
  report?: AttackerReport;
  findings?: unknown[];
  error?: string;
};
