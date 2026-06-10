"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Info, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  QueueHealthResult,
  QUEUE_HEALTH_THRESHOLDS,
} from "@/lib/dashboard.utils";
import { QueueHealthBadge } from "./QueueHealthBadge";

/**
 * Queue Health KPI card with a click-to-open explanation popover. Shows the
 * status badge, the headline reason, a compact metric line, and an info button
 * that reveals the full criteria + current values.
 */
export function QueueHealthCard({ health }: { health: QueueHealthResult }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const m = health.metrics;
  const metricLine = `${m.activeTickets} active · ${m.highRiskTickets} high-risk · ${m.recentAttacks15m} in 15m`;

  return (
    <Card className="relative flex h-[150px] flex-col justify-between p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Queue Health
        </span>
        <div className="flex items-center gap-1">
          <Activity className="size-4 text-emerald-400" />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Explain Queue Health criteria"
            aria-expanded={open}
            className="rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <QueueHealthBadge health={health.status} />
        <p className="text-[11px] tabular-nums text-muted-foreground/80">
          {metricLine}
        </p>
      </div>

      {open && (
        <div ref={containerRef}>
          <QueueHealthPopover health={health} onClose={() => setOpen(false)} />
        </div>
      )}
    </Card>
  );
}

const STATUS_TEXT: Record<QueueHealthResult["status"], string> = {
  Stable: "text-emerald-400",
  Busy: "text-amber-400",
  Overloaded: "text-red-400",
};

function QueueHealthPopover({
  health,
  onClose,
}: {
  health: QueueHealthResult;
  onClose: () => void;
}) {
  const m = health.metrics;
  const T = QUEUE_HEALTH_THRESHOLDS;

  const metricRows: Array<{ label: string; current: number; max?: number }> = [
    { label: "Active tickets", current: m.activeTickets, max: T.activeTickets.overloaded },
    { label: "High-risk tickets", current: m.highRiskTickets, max: T.highRiskTickets.overloaded },
    { label: "Attacks in last 15m", current: m.recentAttacks15m, max: T.recentAttacks15m.overloaded },
    { label: "Suppressed events", current: m.suppressedEvents, max: T.suppressedEvents.overloaded },
    { label: "Grouped events", current: m.groupedEvents },
  ];

  return (
    <div
      role="dialog"
      aria-label="Queue Health Criteria"
      // Frosted, mostly-opaque dark card so nothing underneath shows through.
      className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border p-4 text-xs shadow-2xl"
      style={{
        background: "rgba(15, 23, 42, 0.96)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Queue Health Criteria
        </h4>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Current status + reason */}
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("text-sm font-bold", STATUS_TEXT[health.status])}>
          {health.status}
        </span>
        <span className="text-muted-foreground">— {health.reason}</span>
      </div>

      {/* Current metrics vs overloaded threshold */}
      <div className="mb-3 space-y-1">
        {metricRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-mono tabular-nums text-foreground">
              {row.current}
              {row.max != null && (
                <span className="text-muted-foreground/70"> / {row.max}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Rules */}
      <div className="space-y-2 border-t border-border pt-3">
        <RuleBlock
          title="Stable"
          tone="text-emerald-400"
          rules={[
            "active tickets < 20",
            "high-risk tickets < 5",
            "attacks in last 15m < 5",
            "suppressed events < 50",
          ]}
        />
        <RuleBlock
          title="Busy"
          tone="text-amber-400"
          rules={[
            "active tickets ≥ 20",
            "high-risk tickets ≥ 5",
            "attacks in last 15m ≥ 5",
            "suppressed events ≥ 50",
          ]}
        />
        <RuleBlock
          title="Overloaded"
          tone="text-red-400"
          rules={[
            "active tickets ≥ 50",
            "high-risk tickets ≥ 15",
            "attacks in last 15m ≥ 20",
            "suppressed events ≥ 150",
          ]}
        />
      </div>

      <p className="mt-3 border-t border-border pt-2 text-[11px] italic text-muted-foreground">
        Final status uses the highest triggered level. Overloaded overrides Busy.
      </p>
    </div>
  );
}

function RuleBlock({
  title,
  tone,
  rules,
}: {
  title: string;
  tone: string;
  rules: string[];
}) {
  return (
    <div>
      <p className={cn("font-semibold", tone)}>{title}</p>
      <ul className="ml-3 list-disc text-muted-foreground">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
