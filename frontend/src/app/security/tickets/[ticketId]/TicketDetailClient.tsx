"use client";

import Link from "next/link";
import { ShieldHalf, ArrowLeft, ShieldX } from "lucide-react";
import { RecommendedAction } from "@/lib/ticket.types";
import { useTicketStore } from "@/stores/ticket.store";
import { useHydrated } from "@/stores/useHydrated";
import { useToast } from "@/components/ui/toast";
import { TicketDetailHeader } from "@/components/tickets/TicketDetailHeader";
import { AttackSummaryCard } from "@/components/tickets/AttackSummaryCard";
import { OriginAnalysisCard } from "@/components/tickets/OriginAnalysisCard";
import { AutomatedMeasuresCard } from "@/components/tickets/AutomatedMeasuresCard";
import { EvidenceLogTable } from "@/components/tickets/EvidenceLogTable";
import { RecommendedActionsList } from "@/components/tickets/RecommendedActionsList";
import { AIAnalysisCard } from "@/components/tickets/AIAnalysisCard";
import { TicketTimeline } from "@/components/tickets/TicketTimeline";
import { TicketActivity } from "@/components/tickets/TicketActivity";
import { TicketSidebar } from "@/components/tickets/TicketSidebar";

/** Cycle todo -> in_progress -> done -> todo for the action toggle. */
function cycleStatus(s: RecommendedAction["status"]): RecommendedAction["status"] {
  if (s === "todo") return "in_progress";
  if (s === "in_progress") return "done";
  return "todo";
}

const BackLink = () => (
  <div className="mb-4 flex items-center justify-between">
    <Link
      href="/security/tickets"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to queue
    </Link>
    <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
      <ShieldHalf className="size-4 text-primary" />
      Sandboxed Defender
    </div>
  </div>
);

export function TicketDetailClient({ ticketId }: { ticketId: string }) {
  const { toast } = useToast();
  const hydrated = useHydrated();

  // Read the live ticket straight from the store; no local copy. Selecting by
  // id keeps this component subscribed to just this ticket's changes.
  const ticket = useTicketStore((s) =>
    s.tickets.find((t) => t.ticket_id === ticketId)
  );

  // Store actions (stable references).
  const markResolved = useTicketStore((s) => s.markResolved);
  const reopenTicket = useTicketStore((s) => s.reopenTicket);
  const notifyDeveloper = useTicketStore((s) => s.notifyDeveloper);
  const updateRecommendedActionStatus = useTicketStore(
    (s) => s.updateRecommendedActionStatus
  );
  const addActivity = useTicketStore((s) => s.addActivity);

  // Until the persisted store hydrates on the client, avoid asserting "not
  // found" (the SSR pass can't see localStorage).
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <BackLink />
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading ticket…
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <BackLink />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-12 text-center">
          <ShieldX className="size-8 text-muted-foreground" />
          <div>
            <p className="text-base font-semibold text-foreground">
              Ticket not found
            </p>
            <p className="text-sm text-muted-foreground">
              No ticket matches <span className="font-mono">{ticketId}</span>.
            </p>
          </div>
          <Link
            href="/security/tickets"
            className="text-sm font-medium text-primary hover:underline"
          >
            Return to the queue
          </Link>
        </div>
      </div>
    );
  }

  function handleResolve() {
    markResolved(ticketId);
    toast({ variant: "success", title: "Ticket resolved", description: ticketId });
  }

  function handleReopen() {
    reopenTicket(ticketId);
    toast({ title: "Ticket reopened", description: ticketId });
  }

  function handleNotify() {
    notifyDeveloper(ticketId);
    toast({ variant: "alert", title: "Developer notified" });
  }

  function handleExport() {
    if (typeof window === "undefined" || !ticket) return;
    const blob = new Blob([JSON.stringify(ticket, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticket.ticket_id}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
    addActivity(ticketId, {
      id: `a-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: "System",
      message: "Incident report exported (JSON).",
    });
    toast({ title: "Report exported", description: `${ticket.ticket_id}-report.json` });
  }

  function handleToggleRecommendation(actionId: string) {
    if (!ticket) return;
    const current = ticket.recommended_actions.find((a) => a.id === actionId);
    if (!current) return;
    updateRecommendedActionStatus(ticketId, actionId, cycleStatus(current.status));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackLink />

      <TicketDetailHeader
        ticket={ticket}
        onResolve={handleResolve}
        onReopen={handleReopen}
        onNotify={handleNotify}
        onExport={handleExport}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AttackSummaryCard ticket={ticket} />
            <OriginAnalysisCard ticket={ticket} />
          </div>

          <AIAnalysisCard ticket={ticket} />
          <AutomatedMeasuresCard ticket={ticket} />
          <EvidenceLogTable ticket={ticket} />
          <RecommendedActionsList
            actions={ticket.recommended_actions}
            onToggleStatus={handleToggleRecommendation}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TicketTimeline ticket={ticket} />
            <TicketActivity
              activity={ticket.activity}
              onAddComment={(msg) =>
                addActivity(ticketId, {
                  id: `a-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  actor: "Developer",
                  message: msg,
                })
              }
            />
          </div>
        </div>

        <TicketSidebar
          ticket={ticket}
          onResolve={handleResolve}
          onReopen={handleReopen}
          onNotify={handleNotify}
          onExport={handleExport}
        />
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Demo view · shared store · changes persist to localStorage.
      </p>
    </div>
  );
}
