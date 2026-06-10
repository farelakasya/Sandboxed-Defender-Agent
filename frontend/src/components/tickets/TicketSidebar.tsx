"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Activity,
  Zap,
  ShieldCheck,
  Users,
  Timer,
  CheckCircle2,
  RotateCcw,
  FileDown,
  Flag,
  AlertOctagon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TicketSeverityBadge } from "./TicketSeverityBadge";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketPriorityBadge } from "./TicketPriorityBadge";
import { SecurityTicket } from "@/lib/ticket.types";
import { formatDefenderAction, isTicketOverdue } from "@/lib/ticket.utils";

interface Props {
  ticket: SecurityTicket;
  onResolve: () => void;
  onReopen: () => void;
  onExport: () => void;
}

/** Live countdown to the SLA due time. Placeholder — recomputes each second. */
function useCountdown(dueIso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!dueIso) return null;
  const diff = new Date(dueIso).getTime() - now;
  if (Number.isNaN(diff)) return null;
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { text: `${pad(h)}:${pad(m)}:${pad(s)}`, overdue };
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Activity;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

export function TicketSidebar({
  ticket,
  onResolve,
  onReopen,
  onExport,
}: Props) {
  const countdown = useCountdown(ticket.sla_due_at);
  const overdue = isTicketOverdue(ticket);
  const isResolved =
    ticket.status === "resolved" || ticket.status === "false_positive";
  const topAction = ticket.recommended_actions.find((a) => a.status !== "done");

  return (
    <div className="space-y-4 lg:sticky lg:top-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <Activity className="size-4 text-primary" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row icon={ShieldAlert} label="Severity">
            <TicketSeverityBadge severity={ticket.severity} withIcon={false} />
          </Row>
          <Row icon={Flag} label="Priority">
            <TicketPriorityBadge priority={ticket.priority} />
          </Row>
          <Row icon={Activity} label="Status">
            <TicketStatusBadge status={ticket.status} />
          </Row>
          <Separator />
          <div className="space-y-1.5">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="size-3.5" />
              Recommended next action
            </span>
            <p className="text-sm font-medium text-foreground">
              {topAction ? topAction.title : "All recommendations resolved 🎉"}
            </p>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              Defender action taken
            </span>
            <p className="text-sm font-medium text-foreground">
              {ticket.action_taken
                ? formatDefenderAction(ticket.defender_action)
                : "No action taken"}
            </p>
          </div>
          <Separator />
          <Row icon={Users} label="Assigned team">
            {ticket.assigned_team ?? "Unassigned"}
          </Row>
          <Row icon={overdue ? AlertOctagon : Timer} label="SLA countdown">
            {/* TODO(api): SLA target should come from incident policy. */}
            {countdown ? (
              <span
                className={
                  countdown.overdue
                    ? "font-mono text-red-400"
                    : "font-mono text-emerald-400"
                }
              >
                {countdown.overdue ? "Overdue " : ""}
                {countdown.text}
              </span>
            ) : (
              "—"
            )}
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Zap className="size-4 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
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
          <Button variant="outline" onClick={onExport}>
            <FileDown />
            Export Report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
