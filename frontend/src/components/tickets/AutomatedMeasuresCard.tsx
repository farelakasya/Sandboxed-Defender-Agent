import { CheckCircle2, Clock, XCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AutomatedMeasure, SecurityTicket } from "@/lib/ticket.types";
import { formatTime } from "@/lib/ticket.utils";

const STATUS_META: Record<
  AutomatedMeasure["status"],
  { text: string; ring: string; label: string; icon: typeof CheckCircle2 }
> = {
  completed: {
    text: "text-emerald-400",
    ring: "border-emerald-500/40 bg-emerald-500/10",
    label: "Completed",
    icon: CheckCircle2,
  },
  pending: {
    text: "text-amber-400",
    ring: "border-amber-500/40 bg-amber-500/10",
    label: "Pending",
    icon: Clock,
  },
  failed: {
    text: "text-red-400",
    ring: "border-red-500/40 bg-red-500/10",
    label: "Failed",
    icon: XCircle,
  },
};

export function AutomatedMeasuresCard({ ticket }: { ticket: SecurityTicket }) {
  const completed = ticket.automated_measures.filter(
    (m) => m.status === "completed"
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-400" />
            Automated Security Measures
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {completed}/{ticket.automated_measures.length} completed
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ticket.automated_measures.length === 0 ? (
          <p className="text-sm italic text-muted-foreground/60">
            N/A — no automated measures recorded.
          </p>
        ) : (
        <ol className="relative space-y-5">
          <span
            className="absolute left-[11px] top-1 h-[calc(100%-1.5rem)] w-px bg-border"
            aria-hidden
          />
          {ticket.automated_measures.map((m) => {
            const meta = STATUS_META[m.status];
            const Icon = meta.icon;
            return (
              <li key={m.id} className="relative flex gap-3">
                <span
                  className={cn(
                    "z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border",
                    meta.ring
                  )}
                >
                  <Icon className={cn("size-4", meta.text)} />
                </span>
                <div className="flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {m.name}
                    </span>
                    <span className={cn("text-xs font-semibold", meta.text)}>
                      {meta.label}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                      {formatTime(m.timestamp)} UTC
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
        )}
      </CardContent>
    </Card>
  );
}
