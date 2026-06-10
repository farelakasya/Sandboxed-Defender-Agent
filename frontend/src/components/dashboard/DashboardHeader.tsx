import { ShieldHalf } from "lucide-react";
import { QueueHealth } from "@/lib/dashboard.utils";
import { QueueHealthBadge } from "./QueueHealthBadge";

export function DashboardHeader({ health }: { health: QueueHealth }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
          <ShieldHalf className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Live attack activity, automated defense, and recommended fixes
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Queue health</span>
        <QueueHealthBadge health={health} />
      </div>
    </div>
  );
}
