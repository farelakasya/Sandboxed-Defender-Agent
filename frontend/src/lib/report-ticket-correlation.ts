/**
 * Report → defender-ticket correlation helpers (lightweight seam).
 *
 * Attacker reports are the launch-side output; defender tickets are the
 * source-of-truth defender output (from the defender backend DB). Linking
 * happens when the attacker app / defender backend provides explicit
 * `mapped_ticket_id` / `linked_ticket_ids`, or — as a best-effort hint only —
 * when an existing ticket plausibly matches the report's vector/target/IP/time.
 *
 * This NEVER creates tickets. In backend mode, tickets come from the backend.
 */
import type { AttackerReport } from "./attacker-report.types";
import type { SecurityTicket } from "./ticket.types";

export type ReportTicketLinkStatus =
  | { state: "linked"; ticketIds: string[] }
  | { state: "suggested"; ticketIds: string[] }
  | { state: "waiting"; message: string };

/** The run id the report belongs to (for callback/status correlation). */
export function getReportRunId(report: AttackerReport): string {
  return report.run_id;
}

/**
 * Explicit ticket links the report already carries: any finding's
 * `mapped_ticket_id` plus `defender_result.linked_ticket_ids`. De-duplicated.
 */
export function getLinkedTicketIdsFromReport(report: AttackerReport): string[] {
  const ids = new Set<string>();
  for (const f of report.findings) {
    if (f.mapped_ticket_id) ids.add(f.mapped_ticket_id);
  }
  for (const id of report.defender_result?.linked_ticket_ids ?? []) {
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Default correlation window for "recent" ticket suggestions. */
const RECENT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Best-effort match of EXISTING tickets to a report. Pure heuristic hint — used
 * only to suggest possible matches in the UI, never to assert a link. Matches on
 * attack_type/vector, affected endpoint, source IP, and a recent timestamp
 * window. Returns at most `limit` tickets, highest-signal first.
 */
export function findPotentialTicketsForReport(
  report: AttackerReport,
  tickets: SecurityTicket[],
  limit = 5
): SecurityTicket[] {
  const reportTime = Date.parse(report.created_at);
  const endpoint = report.target.endpoint?.toLowerCase();

  const scored = tickets
    .map((t) => {
      let score = 0;
      // Vector ↔ attack_type.
      if (t.attack_type && t.attack_type === report.vector_id) score += 3;
      // Endpoint overlap.
      if (
        endpoint &&
        t.affected_endpoint &&
        t.affected_endpoint.toLowerCase().includes(endpoint)
      ) {
        score += 2;
      }
      // Recent timestamp window.
      if (!Number.isNaN(reportTime)) {
        const seen = Date.parse(t.last_seen ?? t.created_at);
        if (
          !Number.isNaN(seen) &&
          Math.abs(seen - reportTime) <= RECENT_WINDOW_MS
        ) {
          score += 1;
        }
      }
      return { ticket: t, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.ticket);
}

/**
 * Resolve the report's link status. Explicit links win; otherwise optional
 * suggestions; otherwise a "waiting for backend verdict" message.
 */
export function getReportTicketLinkStatus(
  report: AttackerReport,
  tickets: SecurityTicket[] = []
): ReportTicketLinkStatus {
  const linked = getLinkedTicketIdsFromReport(report);
  if (linked.length > 0) return { state: "linked", ticketIds: linked };

  const suggested = findPotentialTicketsForReport(report, tickets).map(
    (t) => t.ticket_id
  );
  if (suggested.length > 0) return { state: "suggested", ticketIds: suggested };

  return {
    state: "waiting",
    message:
      "No linked defender ticket yet. Tickets will appear once the defender backend records the verdict.",
  };
}
