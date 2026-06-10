import { CircleAlert, CircleCheck, ShieldHalf } from "lucide-react";
import { QueueHealth } from "@/lib/dashboard.utils";
import { QueueHealthBadge } from "./QueueHealthBadge";
import { cn } from "@/lib/utils";

export function DashboardHeader({
  health,
  backendStatus,
}: {
  health: QueueHealth;
  backendStatus?: "connected" | "unavailable" | "mock";
}) {
  const backendLabel =
    backendStatus === "connected"
      ? "Backend connected"
      : backendStatus === "unavailable"
        ? "Backend unavailable — using mock/local data"
        : backendStatus === "mock"
          ? "Mock/local data"
          : null;
  const BackendIcon = backendStatus === "connected" ? CircleCheck : CircleAlert;

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
        {backendLabel && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs",
              backendStatus === "connected"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-border bg-muted text-muted-foreground"
            )}
          >
            <BackendIcon className="size-3.5" />
            {backendLabel}
          </span>
        )}
        <span className="text-xs text-muted-foreground">Queue health</span>
        <QueueHealthBadge health={health} />
      </div>
    </div>
  );
}
