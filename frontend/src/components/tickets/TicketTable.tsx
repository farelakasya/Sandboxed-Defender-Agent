"use client";

import { useRouter } from "next/navigation";
import { Layers, Check, Minus, Users } from "lucide-react";
import { SecurityTicket } from "@/lib/ticket.types";
import {
  formatActorType,
  formatRelativeTime,
  formatSource,
  getRiskScoreColor,
  getSeverityStyle,
  humanizeAttackType,
} from "@/lib/ticket.utils";
import { cn } from "@/lib/utils";
import { TicketSeverityBadge } from "./TicketSeverityBadge";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketPriorityBadge } from "./TicketPriorityBadge";

interface Props {
  tickets: SecurityTicket[];
  /** ids that should briefly highlight (newly added). */
  highlightedIds?: string[];
}

const COLUMNS = [
  "Priority",
  "Severity",
  "Ticket ID",
  "Title",
  "Attack Type",
  "Affected Endpoint",
  "Source / Actor",
  "Requests",
  "AI Action",
  "Status",
  "Risk",
  "Last Seen",
];

export function TicketTable({ tickets, highlightedIds = [] }: Props) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2.5 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tickets.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length}
                className="px-3 py-10 text-center text-muted-foreground"
              >
                No tickets match the current filters.
              </td>
            </tr>
          ) : (
            tickets.map((t) => {
              const sev = getSeverityStyle(t.severity);
              const highlighted = highlightedIds.includes(t.ticket_id);
              return (
                <tr
                  key={t.ticket_id}
                  onClick={() => router.push(`/security/tickets/${t.ticket_id}`)}
                  className={cn(
                    "cursor-pointer border-l-2 transition-colors hover:bg-muted/40",
                    sev.accent,
                    t.is_grouped && "bg-primary/[0.04]",
                    highlighted && "animate-pulse-ring bg-primary/10"
                  )}
                >
                  <td className="px-3 py-3">
                    <TicketPriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-3 py-3">
                    <TicketSeverityBadge severity={t.severity} withIcon={false} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-medium text-foreground">
                    {t.ticket_id}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {t.is_grouped && (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary"
                          title={`Campaign of ${t.grouped_event_count ?? 0} grouped events`}
                        >
                          <Layers className="size-3" />
                          Campaign
                        </span>
                      )}
                      <span className="font-medium text-foreground">
                        {t.title}
                      </span>
                    </div>
                    {t.is_grouped && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {t.grouped_event_count ?? 0} grouped ·{" "}
                        {t.suppressed_event_count ?? 0} suppressed
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                    {humanizeAttackType(t.attack_type)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                    {t.affected_endpoint}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    <div className="flex items-center gap-1.5 text-foreground">
                      {t.is_grouped ? (
                        <>
                          <Users className="size-3.5 text-muted-foreground" />
                          Multiple IPs
                        </>
                      ) : (
                        <span className="font-mono">{t.source_ip ?? "—"}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatSource(t.source)} · {formatActorType(t.actor_type)}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{t.request_count}</td>
                  <td className="px-3 py-3">
                    {t.action_taken ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <Check className="size-3.5" />
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Minus className="size-3.5" />
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 font-mono text-xs font-bold tabular-nums",
                      getRiskScoreColor(t.risk_score)
                    )}
                  >
                    {t.risk_score}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                    {formatRelativeTime(t.last_seen)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
