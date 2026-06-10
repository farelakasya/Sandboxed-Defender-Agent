import { XCircle, UserX, Ban, BellRing } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DashboardMetrics } from "@/lib/dashboard.utils";

/**
 * Compact strip of richer defender-side aggregates that only the backend
 * provides (dismissed verdicts, flagged/blocked users, automatic admin
 * notifications). Rendered only in backend mode; hides cleanly when the fields
 * are absent so mock mode is unaffected.
 */
export function BackendPostureStrip({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    {
      label: "Dismissed",
      value: metrics.dismissed,
      icon: XCircle,
      tone: "text-muted-foreground",
    },
    {
      label: "Flagged Users",
      value: metrics.flaggedUsers,
      icon: UserX,
      tone: "text-amber-400",
    },
    {
      label: "Blocked Users",
      value: metrics.blockedUsers,
      icon: Ban,
      tone: "text-violet-400",
    },
    {
      label: "Admin Notifications",
      value: metrics.adminNotifications,
      icon: BellRing,
      tone: "text-cyan-400",
    },
  ].filter((c) => typeof c.value === "number");

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="flex items-center gap-3 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
            <Icon className={cn("size-4", tone)} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {value}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
