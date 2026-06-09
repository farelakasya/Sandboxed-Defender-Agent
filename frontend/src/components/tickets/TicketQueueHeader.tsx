"use client";

import { ShieldHalf, Zap, Layers, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onSimulateNew: () => void;
  onSimulateOverload: () => void;
  busy?: boolean;
}

export function TicketQueueHeader({
  onSimulateNew,
  onSimulateOverload,
  busy,
}: Props) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <ShieldHalf className="size-5 text-primary" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Security Ticket Queue
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Monitor attack tickets, automated responses, and developer actions
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
            <Layers className="size-3.5" />
            Demo
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
            <Bot className="size-3.5" />
            Auto-response enabled
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSimulateNew} disabled={busy}>
          <Zap />
          Simulate New Attack Ticket
        </Button>
        <Button variant="outline" onClick={onSimulateOverload} disabled={busy}>
          <Layers />
          Simulate Overload
        </Button>
      </div>
    </div>
  );
}
