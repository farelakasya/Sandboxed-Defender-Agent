"use client";

import {
  CheckCircle2,
  RotateCcw,
  BellRing,
  FileDown,
  Clock,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketSeverityBadge } from "./TicketSeverityBadge";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketPriorityBadge } from "./TicketPriorityBadge";
import { SecurityTicket } from "@/lib/ticket.types";
import { formatDateTime, humanizeAttackType } from "@/lib/ticket.utils";

interface Props {
  ticket: SecurityTicket;
  onResolve: () => void;
  onReopen: () => void;
  onNotify: () => void;
  onExport: () => void;
}

export function TicketDetailHeader({
  ticket,
  onResolve,
  onReopen,
  onNotify,
  onExport,
}: Props) {
  const isResolved =
    ticket.status === "resolved" || ticket.status === "false_positive";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="size-4" />
            <span className="font-mono font-medium text-foreground">
              {ticket.ticket_id}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>{humanizeAttackType(ticket.attack_type)}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {ticket.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <TicketSeverityBadge severity={ticket.severity} />
            <TicketPriorityBadge priority={ticket.priority} />
            <TicketStatusBadge status={ticket.status} />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Created {formatDateTime(ticket.created_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="size-3.5" />
              Updated {formatDateTime(ticket.updated_at)}
            </span>
          </div>
        </div>

        {/* Local-state action buttons (no backend yet). */}
        <div className="flex flex-wrap gap-2">
          {isResolved ? (
            <Button variant="outline" onClick={onReopen}>
              <RotateCcw />
              Reopen Ticket
            </Button>
          ) : (
            <Button variant="success" onClick={onResolve}>
              <CheckCircle2 />
              Mark as Resolved
            </Button>
          )}
          <Button variant="outline" onClick={onNotify}>
            <BellRing />
            Notify Developer
          </Button>
          <Button variant="outline" onClick={onExport}>
            <FileDown />
            Export Report
          </Button>
        </div>
      </div>
    </div>
  );
}
